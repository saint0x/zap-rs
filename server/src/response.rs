//! Response types and utilities for ZapServer

use std::path::PathBuf;

use bytes::Bytes;
use serde::Serialize;

use zap_core::{Response, StatusCode, ResponseBody};

/// Zap response types with auto-serialization
#[derive(Debug)]
pub enum ZapResponse {
    /// Plain text response
    Text(String),
    /// HTML response
    Html(String),
    /// JSON response (auto-serialized)
    Json(serde_json::Value),
    /// Binary response
    Bytes(Bytes),
    /// File response
    File(PathBuf),
    /// Custom response with full control
    Custom(Response),
    /// Redirect response
    Redirect(String),
    /// Empty response with status code
    Status(StatusCode),
}

/// JSON response wrapper for auto-serialization
#[derive(Debug)]
pub struct Json<T>(pub T);

impl<T: Serialize> From<Json<T>> for ZapResponse {
    fn from(json: Json<T>) -> Self {
        match serde_json::to_value(json.0) {
            Ok(value) => ZapResponse::Json(value),
            Err(_) => ZapResponse::Custom(
                Response::internal_server_error("Failed to serialize JSON"),
            ),
        }
    }
}

impl ZapResponse {
    /// Convert ZapResponse to hyper Response
    pub fn to_hyper_response(&self) -> hyper::Response<String> {
        match self {
            ZapResponse::Text(text) => hyper::Response::builder()
                .status(200)
                .header("Content-Type", "text/plain; charset=utf-8")
                .body(text.clone())
                .unwrap(),
            ZapResponse::Html(html) => hyper::Response::builder()
                .status(200)
                .header("Content-Type", "text/html; charset=utf-8")
                .body(html.clone())
                .unwrap(),
            ZapResponse::Json(json) => {
                let body = serde_json::to_string(json).unwrap_or_else(|_| {
                    r#"{"error": "Failed to serialize JSON"}"#.to_string()
                });
                hyper::Response::builder()
                    .status(200)
                    .header("Content-Type", "application/json")
                    .body(body)
                    .unwrap()
            }
            ZapResponse::Bytes(bytes) => hyper::Response::builder()
                .status(200)
                .header("Content-Type", "application/octet-stream")
                .body(String::from_utf8_lossy(bytes).to_string())
                .unwrap(),
            ZapResponse::Custom(response) => {
                let status = response.status.as_u16();
                let mut builder = hyper::Response::builder().status(status);
                
                for (key, value) in &response.headers {
                    builder = builder.header(key, value);
                }
                
                let body = match &response.body {
                    ResponseBody::Empty => String::new(),
                    ResponseBody::Text(text) => text.clone(),
                    ResponseBody::Bytes(bytes) => {
                        String::from_utf8_lossy(bytes).to_string()
                    }
                };
                
                builder.body(body).unwrap()
            }
            ZapResponse::Redirect(location) => hyper::Response::builder()
                .status(302)
                .header("Location", location)
                .body(String::new())
                .unwrap(),
            ZapResponse::Status(status) => hyper::Response::builder()
                .status(status.as_u16())
                .body(String::new())
                .unwrap(),
            ZapResponse::File(_path) => {
                // File serving would be implemented here
                // For now, return not implemented
                hyper::Response::builder()
                    .status(501)
                    .body("File serving not yet implemented".to_string())
                    .unwrap()
            }
        }
    }
} 