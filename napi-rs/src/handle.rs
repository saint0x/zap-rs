use crate::error::ZapError;
use crate::types::{JsRequest, JsResponse};
use crate::middleware::MiddlewareChain;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct Handle {
    middleware: Arc<Mutex<MiddlewareChain>>,
}

impl Handle {
    pub fn new() -> Self {
        Self {
            middleware: Arc::new(Mutex::new(MiddlewareChain::new())),
        }
    }

    pub async fn handle(&self, request: JsRequest) -> Result<JsResponse, ZapError> {
        let middleware = self.middleware.lock().await;
        middleware.execute(request).await
    }
} 