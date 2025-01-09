use napi_derive::napi;
use napi::bindgen_prelude::*;
use hyper::{Method, Uri, Request, Response, Body};
use std::collections::HashMap;
use std::convert::TryFrom;
use crate::error::ZapError;

#[napi]
#[derive(Debug, Clone)]
pub struct JsRequest {
    pub method: String,
    pub uri: String,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
}

impl Default for JsRequest {
    fn default() -> Self {
        Self {
            method: "GET".to_string(),
            uri: "/".to_string(),
            headers: HashMap::new(),
            body: None,
        }
    }
}

impl TryFrom<Request<Body>> for JsRequest {
    type Error = ZapError;

    fn try_from(req: Request<Body>) -> Result<Self, Self::Error> {
        let (parts, body) = req.into_parts();
        let body_bytes = hyper::body::to_bytes(body)
            .await
            .map_err(|e| ZapError::internal(e.to_string()))?;
        let body = String::from_utf8(body_bytes.to_vec())
            .map_err(|e| ZapError::internal(e.to_string()))?;

        Ok(Self {
            method: parts.method.to_string(),
            uri: parts.uri.to_string(),
            headers: parts.headers.iter()
                .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
                .collect(),
            body: Some(body),
        })
    }
}

impl TryFrom<JsRequest> for Request<Body> {
    type Error = ZapError;

    fn try_from(req: JsRequest) -> Result<Self, Self::Error> {
        let mut builder = Request::builder()
            .method(req.method.parse::<Method>().map_err(|_| ZapError::bad_request("Invalid method"))?)
            .uri(req.uri.parse::<Uri>().map_err(|_| ZapError::bad_request("Invalid URI"))?);

        let headers = builder.headers_mut().unwrap();
        for (key, value) in req.headers {
            headers.insert(
                key.parse().map_err(|_| ZapError::bad_request("Invalid header name"))?,
                value.parse().map_err(|_| ZapError::bad_request("Invalid header value"))?,
            );
        }

        builder.body(Body::from(req.body.unwrap_or_default()))
            .map_err(|e| ZapError::internal(e.to_string()))
    }
}

#[napi]
#[derive(Debug, Clone)]
pub struct JsResponse {
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
}

impl Default for JsResponse {
    fn default() -> Self {
        Self {
            status: 200,
            headers: HashMap::new(),
            body: None,
        }
    }
}

impl TryFrom<Response<Body>> for JsResponse {
    type Error = ZapError;

    fn try_from(resp: Response<Body>) -> Result<Self, Self::Error> {
        let (parts, body) = resp.into_parts();
        let body_bytes = hyper::body::to_bytes(body)
            .await
            .map_err(|e| ZapError::internal(e.to_string()))?;
        let body = String::from_utf8(body_bytes.to_vec())
            .map_err(|e| ZapError::internal(e.to_string()))?;

        Ok(Self {
            status: parts.status.as_u16(),
            headers: parts.headers.iter()
                .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
                .collect(),
            body: Some(body),
        })
    }
}

impl TryFrom<JsResponse> for Response<Body> {
    type Error = ZapError;

    fn try_from(resp: JsResponse) -> Result<Self, Self::Error> {
        let mut builder = Response::builder()
            .status(resp.status);

        let headers = builder.headers_mut().unwrap();
        for (key, value) in resp.headers {
            headers.insert(
                key.parse().map_err(|_| ZapError::bad_request("Invalid header name"))?,
                value.parse().map_err(|_| ZapError::bad_request("Invalid header value"))?,
            );
        }

        builder.body(Body::from(resp.body.unwrap_or_default()))
            .map_err(|e| ZapError::internal(e.to_string()))
    }
} 