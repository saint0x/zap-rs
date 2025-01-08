use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use hyper::{Request, Response, Body};
use crate::error::Error;

// Thread-safe handler wrapper that can be cloned efficiently
#[derive(Clone)]
pub struct Handle(Arc<HandleInner>);

struct HandleInner {
    func: Arc<dyn Fn(Request<Body>) -> Pin<Box<dyn Future<Output = Result<Response<Body>, Error>> + Send>> + Send + Sync>,
}

impl Handle {
    pub fn new<F, Fut>(f: F) -> Self
    where
        F: Fn(Request<Body>) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = Result<Response<Body>, Error>> + Send + 'static,
    {
        Self(Arc::new(HandleInner {
            func: Arc::new(move |req| Box::pin(f(req))),
        }))
    }

    pub fn call(&self, req: Request<Body>) -> Pin<Box<dyn Future<Output = Result<Response<Body>, Error>> + Send>> {
        (self.0.func)(req)
    }
}

impl std::fmt::Debug for Handle {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Handle").finish()
    }
} 