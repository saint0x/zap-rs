//! Request types and utilities for ZapServer

use std::collections::HashMap;
use zap_core::{Request, Method};

/// Request data that can be owned and moved between threads
#[derive(Debug, Clone)]
pub struct RequestData {
    pub method: Method,
    pub path: String,
    pub path_only: String,
    pub version: String,
    pub headers: HashMap<String, String>,
    pub body: Vec<u8>,
    pub params: HashMap<String, String>,
    pub query: HashMap<String, String>,
    pub cookies: HashMap<String, String>,
}

impl RequestData {
    /// Create RequestData from a borrowed Request
    pub fn from_request(req: &Request) -> Self {
        Self {
            method: req.method(),
            path: req.path().to_string(),
            path_only: req.path_only().to_string(),
            version: req.version().to_string(),
            headers: req.headers().iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
            body: req.body().to_vec(),
            params: req.params().iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
            query: req.query_params().into_iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
            cookies: req.cookies().into_iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
        }
    }
    
    /// Get parameter by name
    pub fn param(&self, name: &str) -> Option<&str> {
        self.params.get(name).map(|s| s.as_str())
    }
    
    /// Get query parameter by name
    pub fn query(&self, name: &str) -> Option<&str> {
        self.query.get(name).map(|s| s.as_str())
    }
    
    /// Get header by name
    pub fn header(&self, name: &str) -> Option<&str> {
        self.headers.get(name).map(|s| s.as_str())
    }
    
    /// Get cookie by name
    pub fn cookie(&self, name: &str) -> Option<&str> {
        self.cookies.get(name).map(|s| s.as_str())
    }
    
    /// Get body as string
    pub fn body_string(&self) -> Result<String, std::string::FromUtf8Error> {
        String::from_utf8(self.body.clone())
    }
} 