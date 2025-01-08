use std::collections::HashMap;
use napi_derive::napi;
use napi::bindgen_prelude::*;
use serde::{Serialize, Deserialize};
use hyper::{Request, Response, Body, HeaderMap, Method, Uri};
use std::str::FromStr;

#[derive(Debug, Default)]
pub struct RouteParams {
    pub path_params: HashMap<String, String>,
    pub query_params: HashMap<String, String>,
}

#[napi(object)]
#[derive(Default, Serialize, Deserialize)]
pub struct JsRequest {
    pub method: String,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
}

#[napi(object)]
#[derive(Default, Serialize, Deserialize)]
pub struct JsResponse {
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
}

impl RouteParams {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn get_path_param(&self, key: &str) -> Option<&String> {
        self.path_params.get(key)
    }

    pub fn get_query_param(&self, key: &str) -> Option<&String> {
        self.query_params.get(key)
    }
}

impl TryFrom<JsRequest> for Request<Body> {
    type Error = napi::Error;

    fn try_from(js_req: JsRequest) -> Result<Self, Self::Error> {
        // Parse method
        let method = Method::from_str(&js_req.method)
            .map_err(|e| napi::Error::from_reason(format!("Invalid method: {}", e)))?;

        // Parse URI
        let uri = Uri::from_str(&js_req.url)
            .map_err(|e| napi::Error::from_reason(format!("Invalid URL: {}", e)))?;

        // Create request builder
        let mut builder = Request::builder()
            .method(method)
            .uri(uri);

        // Add headers
        if let Some(headers) = builder.headers_mut() {
            for (key, value) in js_req.headers {
                headers.insert(
                    hyper::header::HeaderName::from_str(&key)
                        .map_err(|e| napi::Error::from_reason(format!("Invalid header name: {}", e)))?,
                    hyper::header::HeaderValue::from_str(&value)
                        .map_err(|e| napi::Error::from_reason(format!("Invalid header value: {}", e)))?,
                );
            }
        }

        // Add body
        let body = match js_req.body {
            Some(body) => Body::from(body),
            None => Body::empty(),
        };

        Ok(builder.body(body)
            .map_err(|e| napi::Error::from_reason(format!("Failed to build request: {}", e)))?)
    }
}

impl TryFrom<Response<Body>> for JsResponse {
    type Error = napi::Error;

    fn try_from(response: Response<Body>) -> Result<Self, Self::Error> {
        let (parts, body) = response.into_parts();
        
        // Convert headers
        let mut headers = HashMap::new();
        for (key, value) in parts.headers.iter() {
            headers.insert(
                key.as_str().to_string(),
                value.to_str()
                    .map_err(|e| napi::Error::from_reason(format!("Invalid header value: {}", e)))?
                    .to_string(),
            );
        }

        // Convert body
        let body_bytes = hyper::body::to_bytes(body)
            .await
            .map_err(|e| napi::Error::from_reason(format!("Failed to read body: {}", e)))?;
        
        let body = if body_bytes.is_empty() {
            None
        } else {
            Some(String::from_utf8_lossy(&body_bytes).into_owned())
        };

        Ok(JsResponse {
            status: parts.status.as_u16(),
            headers,
            body,
        })
    }
}

#[napi]
pub async fn create_request(js_req: JsRequest) -> napi::Result<Object> {
    let rust_req: Request<Body> = js_req.try_into()?;
    // Convert to JS object
    let env = napi::Env::get().expect("Failed to get NAPI env");
    let obj = env.create_object()?;
    
    // Set method
    obj.set("method", rust_req.method().as_str())?;
    
    // Set URL
    obj.set("url", rust_req.uri().to_string())?;
    
    // Set headers
    let headers_obj = env.create_object()?;
    for (key, value) in rust_req.headers() {
        headers_obj.set(
            key.as_str(),
            value.to_str().unwrap_or_default()
        )?;
    }
    obj.set("headers", headers_obj)?;

    Ok(obj)
}

#[napi]
pub async fn create_response(status: u16, headers: Object, body: Option<String>) -> napi::Result<JsResponse> {
    let mut response_headers = HashMap::new();
    let env = napi::Env::get().expect("Failed to get NAPI env");
    
    // Convert headers Object to HashMap
    let header_keys = headers.keys()?;
    for key in header_keys {
        if let Ok(value) = headers.get::<String>(&key) {
            response_headers.insert(key, value);
        }
    }

    Ok(JsResponse {
        status,
        headers: response_headers,
        body,
    })
} 