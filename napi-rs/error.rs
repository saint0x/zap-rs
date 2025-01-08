use std::fmt;
use hyper::StatusCode;
use napi_derive::napi;
use napi::bindgen_prelude::*;

#[derive(Debug)]
pub enum Error {
    RouteNotFound(String),
    Internal(String),
    InvalidRequest(String),
    HandlerError(String),
}

#[napi(object)]
#[derive(Default)]
pub struct JsError {
    pub code: String,
    pub message: String,
    pub status: u16,
}

impl Error {
    pub fn status_code(&self) -> StatusCode {
        match self {
            Error::RouteNotFound(_) => StatusCode::NOT_FOUND,
            Error::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Error::InvalidRequest(_) => StatusCode::BAD_REQUEST,
            Error::HandlerError(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    pub fn to_js_error(&self) -> JsError {
        let (code, message) = match self {
            Error::RouteNotFound(path) => ("ROUTE_NOT_FOUND", format!("Route not found: {}", path)),
            Error::Internal(msg) => ("INTERNAL_ERROR", msg.clone()),
            Error::InvalidRequest(msg) => ("INVALID_REQUEST", msg.clone()),
            Error::HandlerError(msg) => ("HANDLER_ERROR", msg.clone()),
        };

        JsError {
            code: code.to_string(),
            message,
            status: self.status_code().as_u16(),
        }
    }
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::RouteNotFound(path) => write!(f, "Route not found: {}", path),
            Error::Internal(msg) => write!(f, "Internal error: {}", msg),
            Error::InvalidRequest(msg) => write!(f, "Invalid request: {}", msg),
            Error::HandlerError(msg) => write!(f, "Handler error: {}", msg),
        }
    }
}

impl From<Error> for napi::Error {
    fn from(error: Error) -> Self {
        let js_error = error.to_js_error();
        napi::Error::from_reason(format!("{}: {}", js_error.code, js_error.message))
    }
}

#[napi]
pub fn create_error(code: String, message: String, status: Option<u16>) -> JsError {
    JsError {
        code,
        message,
        status: status.unwrap_or(500),
    }
} 
impl std::error::Error for Error {} 