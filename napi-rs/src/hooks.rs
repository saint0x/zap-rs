use crate::types::{JsRequest, JsResponse};
use crate::error::ZapError;
use napi_derive::napi;
use napi::threadsafe_function::{ThreadsafeFunction};
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct Hooks {
    pre_routing: Arc<Mutex<Vec<ThreadsafeFunction<JsRequest>>>>,
    post_handler: Arc<Mutex<Vec<ThreadsafeFunction<JsResponse>>>>,
    error_handler: Arc<Mutex<Vec<ThreadsafeFunction<ZapError>>>>,
}

impl Hooks {
    pub fn new() -> Self {
        Self {
            pre_routing: Arc::new(Mutex::new(Vec::new())),
            post_handler: Arc::new(Mutex::new(Vec::new())),
            error_handler: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub async fn add_pre_routing(&self, handler: ThreadsafeFunction<JsRequest>) {
        let mut handlers = self.pre_routing.lock().await;
        handlers.push(handler);
    }

    pub async fn add_post_handler(&self, handler: ThreadsafeFunction<JsResponse>) {
        let mut handlers = self.post_handler.lock().await;
        handlers.push(handler);
    }

    pub async fn add_error_handler(&self, handler: ThreadsafeFunction<ZapError>) {
        let mut handlers = self.error_handler.lock().await;
        handlers.push(handler);
    }

    pub async fn execute_pre_routing(&self, request: JsRequest) -> napi::Result<JsRequest> {
        let handlers = self.pre_routing.lock().await;
        let mut current_request = request;

        for handler in handlers.iter() {
            let result = handler.call_async(Ok(current_request)).await?;
            current_request = result;
        }

        Ok(current_request)
    }

    pub async fn execute_post_handler(&self, response: JsResponse) -> napi::Result<JsResponse> {
        let handlers = self.post_handler.lock().await;
        let mut current_response = response;

        for handler in handlers.iter() {
            let result = handler.call_async(Ok(current_response)).await?;
            current_response = result;
        }

        Ok(current_response)
    }

    pub async fn execute_error_handler(&self, error: ZapError) -> napi::Result<JsResponse> {
        let handlers = self.error_handler.lock().await;

        for handler in handlers.iter() {
            let result = handler.call_async(Ok(error.clone())).await?;
            return Ok(result);
        }

        Err(napi::Error::from_reason(error.to_string()))
    }
}

#[napi]
pub struct JsHooks(Arc<Hooks>);

#[napi]
impl JsHooks {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self(Arc::new(Hooks::new()))
    }

    #[napi]
    pub async fn pre_routing(&self, handler: ThreadsafeFunction<JsRequest>) -> napi::Result<()> {
        self.0.add_pre_routing(handler).await;
        Ok(())
    }

    #[napi]
    pub async fn post_handler(&self, handler: ThreadsafeFunction<JsResponse>) -> napi::Result<()> {
        self.0.add_post_handler(handler).await;
        Ok(())
    }

    #[napi]
    pub async fn error_handler(&self, handler: ThreadsafeFunction<ZapError>) -> napi::Result<()> {
        self.0.add_error_handler(handler).await;
        Ok(())
    }
} 