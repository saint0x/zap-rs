use std::sync::Arc;
use napi_derive::napi;
use napi::bindgen_prelude::*;
use hyper::{Request, Response, Body};
use crate::error::Error;
use crate::types::{JsRequest, JsResponse};
use futures::future::BoxFuture;

pub type HookFn<T> = Arc<dyn Fn(T) -> BoxFuture<'static, Result<T, Error>> + Send + Sync>;

#[napi]
pub struct JsHooks(Arc<Hooks>);

pub struct Hooks {
    pre_routing: Vec<HookFn<Request<Body>>>,
    post_handler: Vec<HookFn<Response<Body>>>,
    error_hooks: Vec<HookFn<Error>>,
}

impl Hooks {
    pub fn new() -> Self {
        Self {
            pre_routing: Vec::new(),
            post_handler: Vec::new(),
            error_hooks: Vec::new(),
        }
    }

    pub async fn execute_pre_routing(&self, req: Request<Body>) -> Result<Request<Body>, Error> {
        let mut current_req = req;
        for hook in &self.pre_routing {
            current_req = hook(current_req).await?;
        }
        Ok(current_req)
    }

    pub async fn execute_post_handler(&self, resp: Response<Body>) -> Result<Response<Body>, Error> {
        let mut current_resp = resp;
        for hook in &self.post_handler {
            current_resp = hook(current_resp).await?;
        }
        Ok(current_resp)
    }

    pub async fn execute_error_hooks(&self, err: Error) -> Result<Response<Body>, Error> {
        let mut current_err = err;
        for hook in &self.error_hooks {
            match hook(current_err.clone()).await {
                Ok(response) => return Ok(response),
                Err(e) => current_err = e,
            }
        }
        Err(current_err)
    }
}

#[napi]
impl JsHooks {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self(Arc::new(Hooks::new()))
    }

    #[napi]
    pub fn pre_routing(&mut self, handler: JsFunction) -> napi::Result<()> {
        let handler = handler.create_threadsafe_function(0, |ctx| {
            Ok(vec![ctx.value])
        })?;

        if let Some(hooks) = Arc::get_mut(&mut self.0) {
            hooks.pre_routing.push(Arc::new(move |req: Request<Body>| {
                let handler = handler.clone();
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

                    // Call JS hook
                    let result = handler.call_async(js_req).await
                        .map_err(|e| Error::Internal(e.to_string()))?;

                    // Convert result back to Rust request
                    let js_req: JsRequest = serde_json::from_value(result)
                        .map_err(|e| Error::Internal(format!("Invalid hook response: {}", e)))?;
                    
                    js_req.try_into()
                        .map_err(|e| Error::Internal(e.to_string()))
                })
            }));
        }

        Ok(())
    }

    #[napi]
    pub fn post_handler(&mut self, handler: JsFunction) -> napi::Result<()> {
        let handler = handler.create_threadsafe_function(0, |ctx| {
            Ok(vec![ctx.value])
        })?;

        if let Some(hooks) = Arc::get_mut(&mut self.0) {
            hooks.post_handler.push(Arc::new(move |resp: Response<Body>| {
                let handler = handler.clone();
                Box::pin(async move {
                    // Convert response to JS format
                    let (parts, body) = resp.into_parts();
                    let body_bytes = hyper::body::to_bytes(body).await
                        .map_err(|e| Error::Internal(e.to_string()))?;
                    
                    let js_resp = JsResponse {
                        status: parts.status.as_u16(),
                        headers: parts.headers.iter().map(|(k, v)| {
                            (k.as_str().to_string(), v.to_str().unwrap_or_default().to_string())
                        }).collect(),
                        body: if body_bytes.is_empty() {
                            None
                        } else {
                            Some(String::from_utf8_lossy(&body_bytes).into_owned())
                        },
                    };

                    // Call JS hook
                    let result = handler.call_async(js_resp).await
                        .map_err(|e| Error::Internal(e.to_string()))?;

                    // Convert result back to Rust response
                    let js_resp: JsResponse = serde_json::from_value(result)
                        .map_err(|e| Error::Internal(format!("Invalid hook response: {}", e)))?;
                    
                    let mut response = Response::builder()
                        .status(js_resp.status);
                    
                    // Add headers
                    if let Some(headers) = response.headers_mut() {
                        for (key, value) in js_resp.headers {
                            headers.insert(
                                hyper::header::HeaderName::from_str(&key)
                                    .map_err(|e| Error::Internal(e.to_string()))?,
                                hyper::header::HeaderValue::from_str(&value)
                                    .map_err(|e| Error::Internal(e.to_string()))?,
                            );
                        }
                    }

                    Ok(response.body(Body::from(js_resp.body.unwrap_or_default()))
                        .map_err(|e| Error::Internal(e.to_string()))?)
                })
            }));
        }

        Ok(())
    }

    #[napi]
    pub fn error_handler(&mut self, handler: JsFunction) -> napi::Result<()> {
        let handler = handler.create_threadsafe_function(0, |ctx| {
            Ok(vec![ctx.value])
        })?;

        if let Some(hooks) = Arc::get_mut(&mut self.0) {
            hooks.error_hooks.push(Arc::new(move |err: Error| {
                let handler = handler.clone();
                Box::pin(async move {
                    // Convert error to JS format
                    let js_error = err.to_js_error();

                    // Call JS hook
                    let result = handler.call_async(js_error).await
                        .map_err(|e| Error::Internal(e.to_string()))?;

                    // Convert result back to Rust response
                    let js_resp: JsResponse = serde_json::from_value(result)
                        .map_err(|e| Error::Internal(format!("Invalid hook response: {}", e)))?;
                    
                    let mut response = Response::builder()
                        .status(js_resp.status);
                    
                    // Add headers
                    if let Some(headers) = response.headers_mut() {
                        for (key, value) in js_resp.headers {
                            headers.insert(
                                hyper::header::HeaderName::from_str(&key)
                                    .map_err(|e| Error::Internal(e.to_string()))?,
                                hyper::header::HeaderValue::from_str(&value)
                                    .map_err(|e| Error::Internal(e.to_string()))?,
                            );
                        }
                    }

                    Ok(response.body(Body::from(js_resp.body.unwrap_or_default()))
                        .map_err(|e| Error::Internal(e.to_string()))?)
                })
            }));
        }

        Ok(())
    }
} 