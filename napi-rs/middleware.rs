use std::sync::Arc;
use std::future::Future;
use std::pin::Pin;
use hyper::{Request, Response, Body};
use crate::error::Error;

pub type Next = Arc<dyn Fn(Request<Body>) -> Pin<Box<dyn Future<Output = Result<Response<Body>, Error>> + Send>> + Send + Sync>;
pub type Middleware = Arc<dyn Fn(Request<Body>, Next) -> Pin<Box<dyn Future<Output = Result<Response<Body>, Error>> + Send>> + Send + Sync>;

pub struct MiddlewareChain {
    middlewares: Vec<Middleware>,
}

impl MiddlewareChain {
    pub fn new() -> Self {
        Self {
            middlewares: Vec::new(),
        }
    }

    pub fn add(&mut self, middleware: Middleware) {
        self.middlewares.push(middleware);
    }

    pub fn compose(self: Arc<Self>, final_handler: Next) -> Next {
        let mut handler = final_handler;
        let middlewares = self.middlewares.clone();

        for middleware in middlewares.iter().rev() {
            let next = handler.clone();
            let current = middleware.clone();
            handler = Arc::new(move |req: Request<Body>| {
                let next = next.clone();
                let current = current.clone();
                Box::pin(async move {
                    current(req, next).await
                })
            });
        }

        handler
    }
}

impl Default for MiddlewareChain {
    fn default() -> Self {
        Self::new()
    }
} 