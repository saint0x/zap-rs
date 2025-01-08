use std::sync::Arc;
use futures::future::BoxFuture;
use hyper::{Body, Request, Response};
use dashmap::DashMap;
use crate::error::Error;
use crate::types::{Middleware, Next};

type SharedHandler = Arc<dyn Fn(Request<Body>) -> BoxFuture<'static, Result<Response<Body>, Error>> + Send + Sync>;

#[derive(Clone)]
pub struct MiddlewareChain {
    middlewares: Arc<DashMap<usize, Arc<Middleware>>>,
}

impl MiddlewareChain {
    pub fn new() -> Self {
        Self {
            middlewares: Arc::new(DashMap::new()),
        }
    }

    pub fn add(&self, middleware: Middleware) {
        let next_idx = self.middlewares.len();
        self.middlewares.insert(next_idx, Arc::new(middleware));
    }

    pub fn execute<'a>(&'a self, req: Request<Body>, handler: Next) -> BoxFuture<'a, Result<Response<Body>, Error>> {
        Box::pin(async move {
            let base_handler: SharedHandler = Arc::new(handler);
            
            // Build the middleware chain from back to front
            let mut chain = base_handler;
            
            for idx in (0..self.middlewares.len()).rev() {
                if let Some(middleware) = self.middlewares.get(&idx) {
                    let middleware = middleware.clone();
                    let next_handler = chain.clone();
                    
                    chain = Arc::new(move |req: Request<Body>| -> BoxFuture<'static, Result<Response<Body>, Error>> {
                        let middleware = middleware.clone();
                        let next = next_handler.clone();
                        
                        Box::pin(async move {
                            middleware(req, Box::new(move |inner_req| {
                                let next = next.clone();
                                Box::pin(async move {
                                    (*next)(inner_req).await
                                })
                            })).await
                        })
                    });
                }
            }
            
            (*chain)(req).await
        })
    }
} 