//! Utility functions for ZapServer

use zap_core::Method;
use crate::error::ZapError;

/// Convert hyper Method to our Method enum
pub fn convert_method(method: &hyper::Method) -> Result<Method, ZapError> {
    match method {
        &hyper::Method::GET => Ok(Method::GET),
        &hyper::Method::POST => Ok(Method::POST),
        &hyper::Method::PUT => Ok(Method::PUT),
        &hyper::Method::PATCH => Ok(Method::PATCH),
        &hyper::Method::DELETE => Ok(Method::DELETE),
        &hyper::Method::HEAD => Ok(Method::HEAD),
        &hyper::Method::OPTIONS => Ok(Method::OPTIONS),
        _ => Err(ZapError::Http(format!("Unsupported method: {}", method))),
    }
} 