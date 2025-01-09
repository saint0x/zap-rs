use napi_derive::napi;
use std::sync::Arc;
use tokio::sync::Mutex;
use std::collections::HashMap;
use crate::types::{JsRequest, JsResponse};
use napi::threadsafe_function::{ThreadsafeFunction};

pub struct Router {
    routes: HashMap<(String, String), ThreadsafeFunction<JsRequest>>,
    middleware: Vec<ThreadsafeFunction<JsRequest>>,
}

impl Router {
    pub fn new() -> Self {
        Self {
            routes: HashMap::new(),
            middleware: Vec::new(),
        }
    }

    pub fn add_route(&mut self, method: String, path: String, handler: ThreadsafeFunction<JsRequest>) {
        self.routes.insert((method, path), handler);
    }

    pub fn add_middleware(&mut self, middleware: ThreadsafeFunction<JsRequest>) {
        self.middleware.push(middleware);
    }

    pub async fn handle(&self, request: JsRequest) -> napi::Result<JsResponse> {
        // Run middleware chain
        let mut current_request = request;
        for middleware in &self.middleware {
            let result = middleware.call_async(Ok(current_request)).await?;
            current_request = result;
        }

        // Find and execute route handler
        let key = (current_request.method.clone(), current_request.uri.clone());
        if let Some(handler) = self.routes.get(&key) {
            handler.call_async(Ok(current_request)).await
        } else {
            Err(napi::Error::from_reason(format!("Route not found: {} {}", key.0, key.1)))
        }
    }
}

#[napi]
pub struct JsRouter(Arc<Mutex<Router>>);

#[napi]
impl JsRouter {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(Router::new())))
    }

    #[napi]
    pub async fn add_route(&self, method: String, path: String, handler: ThreadsafeFunction<JsRequest>) -> napi::Result<()> {
        let mut router = self.0.lock().await;
        router.add_route(method, path, handler);
        Ok(())
    }

    #[napi]
    pub async fn add_middleware(&self, middleware: ThreadsafeFunction<JsRequest>) -> napi::Result<()> {
        let mut router = self.0.lock().await;
        router.add_middleware(middleware);
        Ok(())
    }

    #[napi]
    pub async fn handle(&self, request: JsRequest) -> napi::Result<JsResponse> {
        let router = self.0.lock().await;
        router.handle(request).await
    }
} 