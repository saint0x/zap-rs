use napi_derive::napi;
use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::types::{JsRequest, JsResponse, ZapError, ResponseBody};

// Define specific ThreadsafeFunction types to avoid ambiguity
type RequestTsfn = ThreadsafeFunction<JsRequest, ErrorStrategy = Fatal>;
type ErrorTsfn = ThreadsafeFunction<ZapError, ErrorStrategy = Fatal>;

// Define callback types that are Send + Sync
type RequestCallback = Box<dyn Fn(JsRequest) -> napi::Result<JsResponse> + Send + Sync>;
type ErrorCallback = Box<dyn Fn(ZapError) -> napi::Result<JsResponse> + Send + Sync>;

#[napi]
pub struct JsRouter {
    routes: Arc<RwLock<HashMap<String, RequestCallback>>>,
    middlewares: Arc<RwLock<Vec<RequestCallback>>>,
    hooks: Arc<RwLock<Vec<RequestCallback>>>,
    error_handler: Arc<RwLock<Option<ErrorCallback>>>,
}

#[napi]
impl JsRouter {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            routes: Arc::new(RwLock::new(HashMap::new())),
            middlewares: Arc::new(RwLock::new(Vec::new())),
            hooks: Arc::new(RwLock::new(Vec::new())),
            error_handler: Arc::new(RwLock::new(None)),
        }
    }

    #[napi]
    pub async fn handle(&self, request: JsRequest) -> napi::Result<JsResponse> {
        // Run middlewares
        let middlewares = self.middlewares.read().await;
        for middleware in middlewares.iter() {
            middleware(request.clone())?;
        }

        // Run hooks
        let hooks = self.hooks.read().await;
        for hook in hooks.iter() {
            hook(request.clone())?;
        }

        // O(1) route lookup using hash map
        let route_key = format!("{} {}", request.method, request.uri);
        let routes = self.routes.read().await;
        
        if let Some(handler) = routes.get(&route_key) {
            handler(request)
        } else {
            let error = ZapError {
                code: "NOT_FOUND".to_string(),
                details: None,
            };

            let error_handler = self.error_handler.read().await;
            if let Some(handler) = &*error_handler {
                handler(error)
            } else {
                Ok(JsResponse {
                    status: 404,
                    headers: {
                        let mut map = HashMap::new();
                        map.insert("content-type".to_string(), "application/json".to_string());
                        map
                    },
                    body: Some(ResponseBody {
                        type_: "Text".to_string(),
                        content: "Not Found".to_string(),
                    }),
                })
            }
        }
    }

    #[napi]
    pub async fn get(&mut self, path: String, handler: JsFunction) -> napi::Result<()> {
        let tsfn: RequestTsfn = handler.create_threadsafe_function(0, |ctx| Ok(vec![ctx.value]))?;
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
                Err(_) => Ok(JsResponse {
                    status: 500,
                    headers: HashMap::new(),
                    body: Some(ResponseBody {
                        type_: "Text".to_string(),
                        content: "Internal Server Error".to_string(),
                    }),
                }),
            }
        });

        let mut routes = self.routes.write().await;
        routes.insert(format!("GET {}", path), callback);
        Ok(())
    }

    #[napi]
    pub async fn post(&mut self, path: String, handler: JsFunction) -> napi::Result<()> {
        let tsfn: RequestTsfn = handler.create_threadsafe_function(0, |ctx| Ok(vec![ctx.value]))?;
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
                Err(_) => Ok(JsResponse {
                    status: 500,
                    headers: HashMap::new(),
                    body: Some(ResponseBody {
                        type_: "Text".to_string(),
                        content: "Internal Server Error".to_string(),
                    }),
                }),
            }
        });

        let mut routes = self.routes.write().await;
        routes.insert(format!("POST {}", path), callback);
        Ok(())
    }

    #[napi]
    pub async fn use_middleware(&mut self, middleware: JsFunction) -> napi::Result<()> {
        let tsfn: RequestTsfn = middleware.create_threadsafe_function(0, |ctx| Ok(vec![ctx.value]))?;
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
                Err(_) => Ok(JsResponse {
                    status: 500,
                    headers: HashMap::new(),
                    body: Some(ResponseBody {
                        type_: "Text".to_string(),
                        content: "Internal Server Error".to_string(),
                    }),
                }),
            }
        });

        let mut middlewares = self.middlewares.write().await;
        middlewares.push(callback);
        Ok(())
    }

    #[napi]
    pub async fn add_hook(&mut self, hook: JsFunction) -> napi::Result<()> {
        let tsfn: RequestTsfn = hook.create_threadsafe_function(0, |ctx| Ok(vec![ctx.value]))?;
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
                Err(_) => Ok(JsResponse {
                    status: 500,
                    headers: HashMap::new(),
                    body: Some(ResponseBody {
                        type_: "Text".to_string(),
                        content: "Internal Server Error".to_string(),
                    }),
                }),
            }
        });

        let mut hooks = self.hooks.write().await;
        hooks.push(callback);
        Ok(())
    }

    #[napi]
    pub async fn set_error_handler(&mut self, handler: JsFunction) -> napi::Result<()> {
        let tsfn: ErrorTsfn = handler.create_threadsafe_function(0, |ctx| Ok(vec![ctx.value]))?;
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
                Err(_) => Ok(JsResponse {
                    status: 500,
                    headers: HashMap::new(),
                    body: Some(ResponseBody {
                        type_: "Text".to_string(),
                        content: "Internal Server Error".to_string(),
                    }),
                }),
            }
        });

        let mut error_handler = self.error_handler.write().await;
        *error_handler = Some(callback);
        Ok(())
    }
} 