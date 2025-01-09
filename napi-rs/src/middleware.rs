use crate::error::ZapError;
use crate::types::{JsRequest, JsResponse};
use std::sync::Arc;
use tokio::sync::Mutex;
use std::future::Future;
use std::pin::Pin;

pub type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;
pub type Next<'a> = Box<dyn FnOnce(JsRequest) -> BoxFuture<'a, Result<JsResponse, ZapError>> + Send + 'a>;
pub type Middleware = Box<dyn Fn(JsRequest, Next) -> BoxFuture<Result<JsResponse, ZapError>> + Send + Sync>;

pub struct MiddlewareChain {
    handlers: Arc<Mutex<Vec<Middleware>>>,
}

impl MiddlewareChain {
    pub fn new() -> Self {
        Self {
            handlers: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub fn add(&mut self, middleware: Middleware) {
        self.handlers.blocking_lock().push(middleware);
    }

    pub async fn execute(&self, mut request: JsRequest) -> Result<JsResponse, ZapError> {
        let handlers = Arc::clone(&self.handlers);
        let handlers = handlers.lock().await;

        for handler in handlers.iter().rev() {
            let next: Next = Box::new(move |req| Box::pin(async move { Ok(JsResponse::default()) }));
            request = match handler(request, next).await {
                Ok(response) => return Ok(response),
                Err(e) => return Err(e),
            };
        }

        Ok(JsResponse::default())
    }
} 