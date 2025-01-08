use std::sync::Arc;
use std::future::Future;
use napi_derive::napi;
use napi::bindgen_prelude::*;
use hyper::{Request, Response, Body};
use crate::error::Error;
use crate::types::{JsRequest, JsResponse};

pub type NextFunction = Box<dyn FnOnce(Request<Body>) -> BoxFuture<'static, Result<Response<Body>, Error>> + Send>;
pub type BoxFuture<'a, T> = std::pin::Pin<Box<dyn Future<Output = T> + Send + 'a>>;

#[napi]
pub struct JsMiddleware(Arc<MiddlewareChain>);

pub struct MiddlewareChain {
    middlewares: Vec<Arc<dyn Middleware>>,
}

pub trait Middleware: Send + Sync + 'static {
    fn handle<'a>(&'a self, req: Request<Body>, next: NextFunction) -> BoxFuture<'a, Result<Response<Body>, Error>>;
}

impl MiddlewareChain {
    pub fn new() -> Self {
        Self {
            middlewares: Vec::new(),
        }
    }

    pub fn add<M>(&mut self, middleware: M)
    where
        M: Middleware,
    {
        self.middlewares.push(Arc::new(middleware));
    }

    pub fn compose<F>(&self, final_handler: Arc<F>) -> impl Fn(Request<Body>) -> BoxFuture<'static, Result<Response<Body>, Error>> + Clone
    where
        F: Fn(Request<Body>) -> BoxFuture<'static, Result<Response<Body>, Error>> + Send + Sync + 'static,
    {
        let middlewares = self.middlewares.clone();
        
        move |req: Request<Body>| {
            let mut chain = middlewares.iter().rev().collect::<Vec<_>>();
            let handler = final_handler.clone();

            Box::pin(async move {
                let mut next_fn: NextFunction = Box::new(move |req| {
                    let handler = handler.clone();
                    Box::pin(async move { handler(req).await })
                });

                while let Some(middleware) = chain.pop() {
                    let current_next = next_fn;
                    next_fn = Box::new(move |req| {
                        let middleware = middleware.clone();
                        Box::pin(async move {
                            middleware.handle(req, current_next).await
                        })
                    });
                }

                next_fn(req).await
            })
        }
    }
}

#[napi]
impl JsMiddleware {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self(Arc::new(MiddlewareChain::new()))
    }

    #[napi]
    pub fn use_fn(&mut self, handler: JsFunction) -> napi::Result<()> {
        let handler = handler.create_threadsafe_function(0, |ctx| {
            Ok(vec![ctx.value])
        })?;

        if let Some(chain) = Arc::get_mut(&mut self.0) {
            chain.add(JsMiddlewareWrapper(handler));
        }

        Ok(())
    }
}

struct JsMiddlewareWrapper(ThreadsafeFunction<()>);

impl Middleware for JsMiddlewareWrapper {
    fn handle<'a>(&'a self, req: Request<Body>, next: NextFunction) -> BoxFuture<'a, Result<Response<Body>, Error>> {
        let handler = self.0.clone();
        
        Box::pin(async move {
            // Convert request to JS format
            let js_req = JsRequest {
                method: req.method().as_str().to_string(),
                url: req.uri().to_string(),
                headers: req.headers().iter().map(|(k, v)| {
                    (k.as_str().to_string(), v.to_str().unwrap_or_default().to_string())
                }).collect(),
                body: hyper::body::to_bytes(req.into_body()).await.ok()
                    .map(|b| String::from_utf8_lossy(&b).into_owned()),
            };

            // Call JS middleware
            let result = handler.call_async(js_req).await
                .map_err(|e| Error::Internal(e.to_string()))?;

            // Convert result back to Rust request
            let js_req: JsRequest = serde_json::from_value(result)
                .map_err(|e| Error::Internal(format!("Invalid middleware response: {}", e)))?;
            
            let rust_req: Request<Body> = js_req.try_into()
                .map_err(|e| Error::Internal(e.to_string()))?;

            // Call next middleware
            next(rust_req).await
        })
    }
} 