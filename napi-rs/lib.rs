pub mod error;
pub mod handle;
pub mod hooks;
pub mod middleware;
pub mod router;
pub mod store;
pub mod types;
pub mod trie;

use napi_derive::napi;
use napi::bindgen_prelude::*;
use hyper::{Request, Response, Body};

pub use router::Router;
pub use error::Error;
pub use types::{RouteParams, JsRequest, JsResponse};

#[napi]
pub struct JsRouter(Router);

#[napi]
impl JsRouter {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self(Router::new())
    }

    #[napi]
    pub async fn get(&mut self, path: String, handler: JsFunction) -> napi::Result<()> {
        let handler = handler.create_threadsafe_function(0, |ctx| {
            Ok(vec![ctx.value])
        })?;
        
        self.0.get(&path, move |req: Request<Body>| {
            let handler = handler.clone();
            async move {
                // Convert Rust request to JS request
                let js_req = JsRequest {
                    method: req.method().as_str().to_string(),
                    url: req.uri().to_string(),
                    headers: req.headers().iter().map(|(k, v)| {
                        (k.as_str().to_string(), v.to_str().unwrap_or_default().to_string())
                    }).collect(),
                    body: hyper::body::to_bytes(req.into_body()).await.ok()
                        .map(|b| String::from_utf8_lossy(&b).into_owned()),
                };

                // Call JS handler
                let result = handler.call_async(js_req).await?;
                
                // Convert JS response to Rust response
                let js_resp: JsResponse = serde_json::from_value(result)
                    .map_err(|e| napi::Error::from_reason(format!("Invalid response format: {}", e)))?;
                
                let mut response = Response::builder()
                    .status(js_resp.status);
                
                // Add headers
                if let Some(headers) = response.headers_mut() {
                    for (key, value) in js_resp.headers {
                        headers.insert(
                            hyper::header::HeaderName::from_str(&key)?,
                            hyper::header::HeaderValue::from_str(&value)?,
                        );
                    }
                }

                Ok(response.body(Body::from(js_resp.body.unwrap_or_default()))?)
            }
        }).map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub async fn post(&mut self, path: String, handler: JsFunction) -> napi::Result<()> {
        let handler = handler.create_threadsafe_function(0, |ctx| {
            Ok(vec![ctx.value])
        })?;
        
        self.0.post(&path, move |req: Request<Body>| {
            let handler = handler.clone();
            async move {
                // Convert Rust request to JS request
                let js_req = JsRequest {
                    method: req.method().as_str().to_string(),
                    url: req.uri().to_string(),
                    headers: req.headers().iter().map(|(k, v)| {
                        (k.as_str().to_string(), v.to_str().unwrap_or_default().to_string())
                    }).collect(),
                    body: hyper::body::to_bytes(req.into_body()).await.ok()
                        .map(|b| String::from_utf8_lossy(&b).into_owned()),
                };

                // Call JS handler
                let result = handler.call_async(js_req).await?;
                
                // Convert JS response to Rust response
                let js_resp: JsResponse = serde_json::from_value(result)
                    .map_err(|e| napi::Error::from_reason(format!("Invalid response format: {}", e)))?;
                
                let mut response = Response::builder()
                    .status(js_resp.status);
                
                // Add headers
                if let Some(headers) = response.headers_mut() {
                    for (key, value) in js_resp.headers {
                        headers.insert(
                            hyper::header::HeaderName::from_str(&key)?,
                            hyper::header::HeaderValue::from_str(&value)?,
                        );
                    }
                }

                Ok(response.body(Body::from(js_resp.body.unwrap_or_default()))?)
            }
        }).map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub async fn handle(&self, req: Object) -> napi::Result<Object> {
        let js_req: JsRequest = serde_json::from_value(req.into_unknown())
            .map_err(|e| napi::Error::from_reason(format!("Invalid request format: {}", e)))?;
        
        let rust_req: Request<Body> = js_req.try_into()?;
        
        match self.0.handle(rust_req).await {
            Ok(resp) => {
                let js_resp: JsResponse = resp.try_into()?;
                let env = napi::Env::get().expect("Failed to get NAPI env");
                Ok(serde_json::to_value(js_resp)
                    .map_err(|e| napi::Error::from_reason(format!("Failed to serialize response: {}", e)))?
                    .try_into_js(&env)?)
            }
            Err(e) => Err(e.into())
        }
    }
} 