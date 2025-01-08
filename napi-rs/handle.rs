use std::future::Future;
use std::pin::Pin;
use hyper::{Request, Response, Body};
use crate::error::Error;

pub type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;
pub type HandlerFn = Box<dyn Fn(Request<Body>) -> BoxFuture<'static, Result<Response<Body>, Error>> + Send + Sync>;

pub struct Handle {
    handler: HandlerFn,
}

impl Handle {
    pub fn new<F, Fut>(f: F) -> Self
    where
        F: Fn(Request<Body>) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = Result<Response<Body>, Error>> + Send + 'static,
    {
        Self {
            handler: Box::new(move |req| Box::pin(f(req))),
        }
    }

    pub async fn call(&self, req: Request<Body>) -> Result<Response<Body>, Error> {
        (self.handler)(req).await
    }
}

impl Clone for Handle {
    fn clone(&self) -> Self {
        Self {
            handler: self.handler.clone(),
        }
    }
} 