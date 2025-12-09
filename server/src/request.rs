//! Request types and utilities for ZapServer

use zap_core::{Request, Method};

/// Request data that can be owned and moved between threads
/// Optimized version with reduced allocations
#[derive(Debug, Clone)]
pub struct RequestData {
    pub method: Method,
    pub path: String,
    pub path_only: String,
    pub version: String,
    pub headers: Vec<(String, String)>, // Vec is more efficient for small collections
    pub body: Vec<u8>,
    pub params: Vec<(String, String)>,  // Most routes have < 5 params
    pub query: Vec<(String, String)>,   // Most queries have < 10 params
    pub cookies: Vec<(String, String)>, // Most requests have < 5 cookies
}

impl RequestData {
    /// Create RequestData from a borrowed Request
    /// Optimized to reduce allocations
    pub fn from_request(req: &Request) -> Self {
        // Pre-allocate with expected sizes to reduce reallocations
        let mut headers = Vec::with_capacity(req.headers().len());
        headers.extend(req.headers().iter().map(|(k, v)| (k.to_string(), v.to_string())));
        
        let mut params = Vec::with_capacity(req.params().len());
        params.extend(req.params().iter().map(|(k, v)| (k.to_string(), v.to_string())));
        
        let query_params = req.query_params();
        let mut query = Vec::with_capacity(query_params.len());
        query.extend(query_params.into_iter().map(|(k, v)| (k.to_string(), v.to_string())));
        
        let cookies_map = req.cookies();
        let mut cookies = Vec::with_capacity(cookies_map.len());
        cookies.extend(cookies_map.into_iter().map(|(k, v)| (k.to_string(), v.to_string())));
        
        Self {
            method: req.method(),
            path: req.path().to_string(),
            path_only: req.path_only().to_string(),
            version: req.version().to_string(),
            headers,
            body: req.body().to_vec(),
            params,
            query,
            cookies,
        }
    }
    
    /// Get parameter by name
    #[inline]
    pub fn param(&self, name: &str) -> Option<&str> {
        self.params.iter()
            .find(|(k, _)| k == name)
            .map(|(_, v)| v.as_str())
    }
    
    /// Get query parameter by name
    #[inline]
    pub fn query(&self, name: &str) -> Option<&str> {
        self.query.iter()
            .find(|(k, _)| k == name)
            .map(|(_, v)| v.as_str())
    }
    
    /// Get header by name (case-insensitive)
    #[inline]
    pub fn header(&self, name: &str) -> Option<&str> {
        self.headers.iter()
            .find(|(k, _)| k.eq_ignore_ascii_case(name))
            .map(|(_, v)| v.as_str())
    }
    
    /// Get cookie by name
    #[inline]
    pub fn cookie(&self, name: &str) -> Option<&str> {
        self.cookies.iter()
            .find(|(k, _)| k == name)
            .map(|(_, v)| v.as_str())
    }
    
    /// Get body as string
    pub fn body_string(&self) -> Result<String, std::string::FromUtf8Error> {
        String::from_utf8(self.body.clone())
    }
} 