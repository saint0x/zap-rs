use crate::error::ZapError;
use crate::types::{JsRequest, JsResponse};
use crate::middleware::MiddlewareChain;

pub struct Handle {
    middleware: MiddlewareChain,
}

impl Handle {
    pub fn new() -> Self {
        Self {
            middleware: MiddlewareChain::new(),
        }
    }

    pub fn handle(&self, request: JsRequest) -> Result<JsResponse, ZapError> {
        self.middleware.execute(request)
    }
} 