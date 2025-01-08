use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use hyper::{Request, Response, Body};
use crate::error::Error;

pub type Next = Arc<dyn Fn(Request<Body>) -> Pin<Box<dyn Future<Output = Result<Response<Body>, Error>> + Send>> + Send + Sync>;
pub type Middleware = Box<dyn Fn(Request<Body>, Next) -> Pin<Box<dyn Future<Output = Result<Response<Body>, Error>> + Send>> + Send + Sync>;

#[derive(Default)]
pub struct MiddlewareChain {
    middlewares: Vec<Middleware>,
}

impl MiddlewareChain {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add(&mut self, middleware: Middleware) {
        self.middlewares.push(middleware);
    }

    pub fn compose(self: Arc<Self>, final_handler: Next) -> Next {
        let mut handler = final_handler;
        
        // Compose the middleware chain in reverse order
        for middleware in self.middlewares.iter().rev() {
            let next = handler.clone();
            let middleware = middleware.clone();
            handler = Arc::new(move |req| {
                let next = next.clone();
                let middleware = middleware.clone();
                Box::pin(async move {
                    middleware(req, next).await
                })
            });
        }
        
        handler
    }
} 