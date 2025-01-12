use napi_derive::napi;
use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::types::{JsRequest, JsResponse, ZapError};

// Define specific ThreadsafeFunction types to avoid ambiguity
type PreRoutingTsfn = ThreadsafeFunction<JsRequest, ErrorStrategy = Fatal>;
type PostHandlerTsfn = ThreadsafeFunction<JsResponse, ErrorStrategy = Fatal>;
type ErrorHandlerTsfn = ThreadsafeFunction<ZapError, ErrorStrategy = Fatal>;

// Define callback types that are Send + Sync
type PreRoutingCallback = Box<dyn Fn(JsRequest) -> napi::Result<JsRequest> + Send + Sync>;
type PostHandlerCallback = Box<dyn Fn(JsResponse) -> napi::Result<JsResponse> + Send + Sync>;
type ErrorHandlerCallback = Box<dyn Fn(ZapError) -> napi::Result<JsResponse> + Send + Sync>;

#[napi]
pub struct JsHooks {
    pre_routing: Arc<RwLock<Vec<PreRoutingCallback>>>,
    post_handler: Arc<RwLock<Vec<PostHandlerCallback>>>,
    error_handler: Arc<RwLock<Vec<ErrorHandlerCallback>>>,
}

#[napi]
impl JsHooks {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            pre_routing: Arc::new(RwLock::new(Vec::new())),
            post_handler: Arc::new(RwLock::new(Vec::new())),
            error_handler: Arc::new(RwLock::new(Vec::new())),
        }
    }

    #[napi]
    pub async fn pre_routing(&self, handler: JsFunction) -> napi::Result<()> {
        let tsfn: PreRoutingTsfn = handler.create_threadsafe_function(0, |ctx| Ok(vec![ctx.value]))?;
        let callback = Box::new(move |request: JsRequest| {
            let (tx, rx) = tokio::sync::oneshot::channel();
            
            tsfn.call(
                Ok(request.clone()),
                ThreadsafeFunctionCallMode::NonBlocking,
                |ctx| {
                    tx.send(ctx).ok();
                    Ok(())
                },
            );

            match tokio::runtime::Handle::current().block_on(rx) {
                Ok(result) => result,
                Err(_) => Ok(request),
            }
        });

        let mut handlers = self.pre_routing.write().await;
        handlers.push(callback);
        Ok(())
    }

    #[napi]
    pub async fn post_handler(&self, handler: JsFunction) -> napi::Result<()> {
        let tsfn: PostHandlerTsfn = handler.create_threadsafe_function(0, |ctx| Ok(vec![ctx.value]))?;
        let callback = Box::new(move |response: JsResponse| {
            let (tx, rx) = tokio::sync::oneshot::channel();
            
            tsfn.call(
                Ok(response.clone()),
                ThreadsafeFunctionCallMode::NonBlocking,
                |ctx| {
                    tx.send(ctx).ok();
                    Ok(())
                },
            );

            match tokio::runtime::Handle::current().block_on(rx) {
                Ok(result) => result,
                Err(_) => Ok(response),
            }
        });

        let mut handlers = self.post_handler.write().await;
        handlers.push(callback);
        Ok(())
    }

    #[napi]
    pub async fn error_handler(&self, handler: JsFunction) -> napi::Result<()> {
        let tsfn: ErrorHandlerTsfn = handler.create_threadsafe_function(0, |ctx| Ok(vec![ctx.value]))?;
        let callback = Box::new(move |error: ZapError| {
            let (tx, rx) = tokio::sync::oneshot::channel();
            
            tsfn.call(
                Ok(error.clone()),
                ThreadsafeFunctionCallMode::NonBlocking,
                |ctx| {
                    tx.send(ctx).ok();
                    Ok(())
                },
            );

            match tokio::runtime::Handle::current().block_on(rx) {
                Ok(result) => result,
                Err(_) => Err(napi::Error::from_reason(error.to_string())),
            }
        });

        let mut handlers = self.error_handler.write().await;
        handlers.push(callback);
        Ok(())
    }

    pub async fn execute_pre_routing(&self, request: JsRequest) -> napi::Result<JsRequest> {
        let handlers = self.pre_routing.read().await;
        let mut current_request = request;

        for handler in handlers.iter() {
            current_request = handler(current_request)?;
        }

        Ok(current_request)
    }

    pub async fn execute_post_handler(&self, response: JsResponse) -> napi::Result<JsResponse> {
        let handlers = self.post_handler.read().await;
        let mut current_response = response;

        for handler in handlers.iter() {
            current_response = handler(current_response)?;
        }

        Ok(current_response)
    }

    pub async fn execute_error_handler(&self, error: ZapError) -> napi::Result<JsResponse> {
        let handlers = self.error_handler.read().await;

        for handler in handlers.iter() {
            return handler(error.clone());
        }

        Err(napi::Error::from_reason(error.to_string()))
    }
} 