//! High-level HTTP request abstraction
//!
//! Provides a user-friendly Request object that wraps the low-level parsed HTTP request
//! with convenient methods for accessing parameters, headers, body, and query strings.

use crate::http::{ParsedRequest, Headers};
use crate::params::Params;
use crate::method::Method;
use std::collections::HashMap;
use std::str;

/// High-level HTTP request object
#[derive(Debug)]
pub struct Request<'a> {
    /// Underlying parsed HTTP request
    parsed: &'a ParsedRequest<'a>,
    /// Request body
    body: &'a [u8],
    /// Route parameters (e.g., from "/users/:id")
    params: Params<'a>,
}

impl<'a> Request<'a> {
    /// Create new request from parsed HTTP request and route parameters
    pub fn new(parsed: &'a ParsedRequest<'a>, body: &'a [u8], params: Params<'a>) -> Self {
        Self {
            parsed,
            body,
            params,
        }
    }

    /// Get HTTP method
    #[inline]
    pub fn method(&self) -> Method {
        self.parsed.method
    }

    /// Get request path (including query string)
    #[inline]
    pub fn path(&self) -> &str {
        self.parsed.path
    }

    /// Get request path without query string
    pub fn path_only(&self) -> &str {
        self.parsed.path.split('?').next().unwrap_or(self.parsed.path)
    }

    /// Get HTTP version
    #[inline]
    pub fn version(&self) -> &str {
        self.parsed.version
    }

    /// Get request headers
    #[inline]
    pub fn headers(&self) -> &Headers<'a> {
        &self.parsed.headers
    }

    /// Get header value by name (case-insensitive)
    #[inline]
    pub fn header(&self, name: &str) -> Option<&'a str> {
        self.parsed.headers.get(name)
    }

    /// Get route parameter by name
    #[inline]
    pub fn param(&self, name: &str) -> Option<&'a str> {
        self.params.get(name)
    }

    /// Get all route parameters
    #[inline]
    pub fn params(&self) -> &Params<'a> {
        &self.params
    }

    /// Get request body as bytes
    #[inline]
    pub fn body(&self) -> &[u8] {
        self.body
    }

    /// Get request body as string (if valid UTF-8)
    pub fn body_string(&self) -> Result<&str, str::Utf8Error> {
        str::from_utf8(self.body)
    }

    /// Check if request body is empty
    #[inline]
    pub fn body_is_empty(&self) -> bool {
        self.body.is_empty()
    }

    /// Get Content-Length header
    #[inline]
    pub fn content_length(&self) -> Option<usize> {
        self.parsed.headers.content_length()
    }

    /// Get Content-Type header
    #[inline]
    pub fn content_type(&self) -> Option<&'a str> {
        self.parsed.headers.get("Content-Type")
    }

    /// Check if connection should be kept alive
    #[inline]
    pub fn keep_alive(&self) -> bool {
        self.parsed.headers.keep_alive()
    }

    /// Get User-Agent header
    #[inline]
    pub fn user_agent(&self) -> Option<&'a str> {
        self.parsed.headers.get("User-Agent")
    }

    /// Get Host header
    #[inline]
    pub fn host(&self) -> Option<&'a str> {
        self.parsed.headers.get("Host")
    }

    /// Get remote IP address from X-Forwarded-For or X-Real-IP headers
    pub fn remote_ip(&self) -> Option<&'a str> {
        // Check X-Forwarded-For first (may contain multiple IPs)
        if let Some(forwarded) = self.parsed.headers.get("X-Forwarded-For") {
            // Take the first IP from the comma-separated list
            return forwarded.split(',').next().map(|ip| ip.trim());
        }
        
        // Check X-Real-IP as fallback
        self.parsed.headers.get("X-Real-IP")
    }

    /// Parse request body as form data (application/x-www-form-urlencoded)
    pub fn form_data(&self) -> Result<HashMap<&str, &str>, FormParseError> {
        if !self.body_is_empty() {
            let body_str = self.body_string()
                .map_err(|_| FormParseError::InvalidUtf8)?;
            Ok(parse_form_data(body_str))
        } else {
            Ok(HashMap::new())
        }
    }

    /// Check if request is a multipart form
    pub fn is_multipart(&self) -> bool {
        self.content_type()
            .map(|ct| ct.starts_with("multipart/"))
            .unwrap_or(false)
    }

    /// Check if request expects JSON response (from Accept header)
    pub fn expects_json(&self) -> bool {
        self.parsed.headers.get("Accept")
            .map(|accept| accept.contains("application/json"))
            .unwrap_or(false)
    }

    /// Check if request is AJAX (XMLHttpRequest)
    pub fn is_ajax(&self) -> bool {
        self.parsed.headers.get("X-Requested-With")
            .map(|value| value == "XMLHttpRequest")
            .unwrap_or(false)
    }

    /// Get query parameter by name
    pub fn query(&self, name: &str) -> Option<&'a str> {
        parse_query_string(self.parsed.path).get(name).copied()
    }

    /// Get all query parameters
    pub fn query_params(&self) -> HashMap<&'a str, &'a str> {
        parse_query_string(self.parsed.path)
    }

    /// Get cookie value by name
    pub fn cookie(&self, name: &str) -> Option<&'a str> {
        parse_cookies(self.parsed.headers.get("Cookie")).get(name).copied()
    }

    /// Get all cookies
    pub fn cookies(&self) -> HashMap<&'a str, &'a str> {
        parse_cookies(self.parsed.headers.get("Cookie"))
    }
}

/// Parse query string into key-value pairs
fn parse_query_string(path: &str) -> HashMap<&str, &str> {
    let mut params = HashMap::new();
    
    if let Some(query_start) = path.find('?') {
        let query = &path[query_start + 1..];
        for pair in query.split('&') {
            if let Some(eq_pos) = pair.find('=') {
                let key = &pair[..eq_pos];
                let value = &pair[eq_pos + 1..];
                params.insert(key, value);
            } else if !pair.is_empty() {
                params.insert(pair, "");
            }
        }
    }
    
    params
}

/// Parse cookies from Cookie header
fn parse_cookies(cookie_header: Option<&str>) -> HashMap<&str, &str> {
    let mut cookies = HashMap::new();
    
    if let Some(header) = cookie_header {
        for cookie in header.split(';') {
            let cookie = cookie.trim();
            if let Some(eq_pos) = cookie.find('=') {
                let name = cookie[..eq_pos].trim();
                let value = cookie[eq_pos + 1..].trim();
                cookies.insert(name, value);
            }
        }
    }
    
    cookies
}

/// Parse form data (application/x-www-form-urlencoded)
fn parse_form_data(data: &str) -> HashMap<&str, &str> {
    let mut params = HashMap::new();
    
    for pair in data.split('&') {
        if let Some(eq_pos) = pair.find('=') {
            let key = &pair[..eq_pos];
            let value = &pair[eq_pos + 1..];
            params.insert(key, value);
        } else if !pair.is_empty() {
            params.insert(pair, "");
        }
    }
    
    params
}

/// Form parsing errors
#[derive(Debug, Clone, PartialEq)]
pub enum FormParseError {
    /// Invalid UTF-8 in form data
    InvalidUtf8,
    /// Malformed form data
    InvalidFormat,
}

impl std::fmt::Display for FormParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FormParseError::InvalidUtf8 => write!(f, "Invalid UTF-8 in form data"),
            FormParseError::InvalidFormat => write!(f, "Malformed form data"),
        }
    }
}

impl std::error::Error for FormParseError {}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{HttpParser, Method, Router};

    #[test]
    fn test_request_basic_methods() {
        let request_bytes = b"GET /users/123?page=1&limit=10 HTTP/1.1\r\nHost: example.com\r\nUser-Agent: TestAgent\r\n\r\n";
        let parser = HttpParser::new();
        let parsed = parser.parse_request(request_bytes).unwrap();
        let body = &request_bytes[parsed.body_offset..];
        
        let mut router = Router::new();
        router.insert(Method::GET, "/users/:id", "handler").unwrap();
        
        // Extract path without query string manually for routing
        let path_for_routing = parsed.path.split('?').next().unwrap_or(parsed.path);
        let (_, params) = router.at(parsed.method, path_for_routing).unwrap();
        
        let request = Request::new(&parsed, body, params);
        
        assert_eq!(request.method(), Method::GET);
        assert_eq!(request.path(), "/users/123?page=1&limit=10");
        assert_eq!(request.path_only(), "/users/123");
        assert_eq!(request.version(), "HTTP/1.1");
        assert_eq!(request.param("id"), Some("123"));
        assert_eq!(request.header("Host"), Some("example.com"));
        assert_eq!(request.user_agent(), Some("TestAgent"));
    }

    #[test]
    fn test_query_parameters() {
        let request_bytes = b"GET /search?q=rust&category=web&limit=10 HTTP/1.1\r\nHost: example.com\r\n\r\n";
        let parser = HttpParser::new();
        let parsed = parser.parse_request(request_bytes).unwrap();
        let body = &request_bytes[parsed.body_offset..];
        
        let request = Request::new(&parsed, body, Params::new());
        
        assert_eq!(request.query("q"), Some("rust"));
        assert_eq!(request.query("category"), Some("web"));
        assert_eq!(request.query("limit"), Some("10"));
        assert_eq!(request.query("nonexistent"), None);
        
        let query_params = request.query_params();
        assert_eq!(query_params.len(), 3);
    }

    #[test]
    fn test_cookies() {
        let request_bytes = b"GET / HTTP/1.1\r\nHost: example.com\r\nCookie: session=abc123; theme=dark; lang=en\r\n\r\n";
        let parser = HttpParser::new();
        let parsed = parser.parse_request(request_bytes).unwrap();
        let body = &request_bytes[parsed.body_offset..];
        
        let request = Request::new(&parsed, body, Params::new());
        
        assert_eq!(request.cookie("session"), Some("abc123"));
        assert_eq!(request.cookie("theme"), Some("dark"));
        assert_eq!(request.cookie("lang"), Some("en"));
        assert_eq!(request.cookie("nonexistent"), None);
        
        let cookies = request.cookies();
        assert_eq!(cookies.len(), 3);
    }

    #[test]
    fn test_form_data() {
        let request_bytes = b"POST /submit HTTP/1.1\r\nHost: example.com\r\nContent-Type: application/x-www-form-urlencoded\r\nContent-Length: 43\r\n\r\nname=John+Doe&email=john@example.com&age=30";
        
        let parser = HttpParser::new();
        let parsed = parser.parse_request(request_bytes).unwrap();
        let body = &request_bytes[parsed.body_offset..];
        
        let request = Request::new(&parsed, body, Params::new());
        
        assert_eq!(request.content_type(), Some("application/x-www-form-urlencoded"));
        
        let form_data = request.form_data().unwrap();
        assert_eq!(form_data.get("name"), Some(&"John+Doe"));
        assert_eq!(form_data.get("email"), Some(&"john@example.com"));
        assert_eq!(form_data.get("age"), Some(&"30"));
    }

    #[test]
    fn test_remote_ip() {
        let request_bytes = b"GET / HTTP/1.1\r\nHost: example.com\r\nX-Forwarded-For: 192.168.1.100, 10.0.0.1\r\nX-Real-IP: 192.168.1.100\r\n\r\n";
        let parser = HttpParser::new();
        let parsed = parser.parse_request(request_bytes).unwrap();
        let body = &request_bytes[parsed.body_offset..];
        
        let request = Request::new(&parsed, body, Params::new());
        
        // Should get the first IP from X-Forwarded-For
        assert_eq!(request.remote_ip(), Some("192.168.1.100"));
    }

    #[test]
    fn test_request_type_detection() {
        let ajax_request = b"GET /api/data HTTP/1.1\r\nHost: example.com\r\nX-Requested-With: XMLHttpRequest\r\nAccept: application/json\r\n\r\n";
        let parser = HttpParser::new();
        let parsed = parser.parse_request(ajax_request).unwrap();
        let body = &ajax_request[parsed.body_offset..];
        
        let request = Request::new(&parsed, body, Params::new());
        
        assert!(request.is_ajax());
        assert!(request.expects_json());
    }

    #[test]
    fn test_multipart_detection() {
        let multipart_request = b"POST /upload HTTP/1.1\r\nHost: example.com\r\nContent-Type: multipart/form-data; boundary=----WebKitFormBoundary\r\n\r\n";
        let parser = HttpParser::new();
        let parsed = parser.parse_request(multipart_request).unwrap();
        let body = &multipart_request[parsed.body_offset..];
        
        let request = Request::new(&parsed, body, Params::new());
        
        assert!(request.is_multipart());
    }
} 