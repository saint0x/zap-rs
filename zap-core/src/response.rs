//! High-level HTTP response abstraction
//!
//! Provides a user-friendly Response object with fluent API for building HTTP responses,
//! automatic content-type detection, status code helpers, and streaming support.

use std::collections::HashMap;
use std::fmt;

/// High-level HTTP response builder
#[derive(Debug, Clone)]
pub struct Response {
    /// HTTP status code
    pub status: StatusCode,
    /// Response headers
    pub headers: HashMap<String, String>,
    /// Response body
    pub body: ResponseBody,
}

/// HTTP status code with common status helpers
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct StatusCode(pub u16);

impl StatusCode {
    // 1xx Informational
    pub const CONTINUE: StatusCode = StatusCode(100);
    pub const SWITCHING_PROTOCOLS: StatusCode = StatusCode(101);
    
    // 2xx Success
    pub const OK: StatusCode = StatusCode(200);
    pub const CREATED: StatusCode = StatusCode(201);
    pub const ACCEPTED: StatusCode = StatusCode(202);
    pub const NO_CONTENT: StatusCode = StatusCode(204);
    pub const PARTIAL_CONTENT: StatusCode = StatusCode(206);
    
    // 3xx Redirection
    pub const MULTIPLE_CHOICES: StatusCode = StatusCode(300);
    pub const MOVED_PERMANENTLY: StatusCode = StatusCode(301);
    pub const FOUND: StatusCode = StatusCode(302);
    pub const SEE_OTHER: StatusCode = StatusCode(303);
    pub const NOT_MODIFIED: StatusCode = StatusCode(304);
    pub const TEMPORARY_REDIRECT: StatusCode = StatusCode(307);
    pub const PERMANENT_REDIRECT: StatusCode = StatusCode(308);
    
    // 4xx Client Error
    pub const BAD_REQUEST: StatusCode = StatusCode(400);
    pub const UNAUTHORIZED: StatusCode = StatusCode(401);
    pub const FORBIDDEN: StatusCode = StatusCode(403);
    pub const NOT_FOUND: StatusCode = StatusCode(404);
    pub const METHOD_NOT_ALLOWED: StatusCode = StatusCode(405);
    pub const NOT_ACCEPTABLE: StatusCode = StatusCode(406);
    pub const CONFLICT: StatusCode = StatusCode(409);
    pub const UNPROCESSABLE_ENTITY: StatusCode = StatusCode(422);
    pub const TOO_MANY_REQUESTS: StatusCode = StatusCode(429);
    
    // 5xx Server Error
    pub const INTERNAL_SERVER_ERROR: StatusCode = StatusCode(500);
    pub const NOT_IMPLEMENTED: StatusCode = StatusCode(501);
    pub const BAD_GATEWAY: StatusCode = StatusCode(502);
    pub const SERVICE_UNAVAILABLE: StatusCode = StatusCode(503);
    pub const GATEWAY_TIMEOUT: StatusCode = StatusCode(504);
    
    /// Create new status code
    pub const fn new(code: u16) -> Self {
        StatusCode(code)
    }
    
    /// Get status code as u16
    pub const fn as_u16(self) -> u16 {
        self.0
    }
    
    /// Check if status code indicates success (2xx)
    pub const fn is_success(self) -> bool {
        self.0 >= 200 && self.0 < 300
    }
    
    /// Check if status code indicates client error (4xx)
    pub const fn is_client_error(self) -> bool {
        self.0 >= 400 && self.0 < 500
    }
    
    /// Check if status code indicates server error (5xx)
    pub const fn is_server_error(self) -> bool {
        self.0 >= 500 && self.0 < 600
    }
    
    /// Get canonical reason phrase for status code
    pub fn canonical_reason(self) -> &'static str {
        match self.0 {
            100 => "Continue",
            101 => "Switching Protocols",
            200 => "OK",
            201 => "Created",
            202 => "Accepted",
            204 => "No Content",
            206 => "Partial Content",
            300 => "Multiple Choices",
            301 => "Moved Permanently",
            302 => "Found",
            303 => "See Other",
            304 => "Not Modified",
            307 => "Temporary Redirect",
            308 => "Permanent Redirect",
            400 => "Bad Request",
            401 => "Unauthorized",
            403 => "Forbidden",
            404 => "Not Found",
            405 => "Method Not Allowed",
            406 => "Not Acceptable",
            409 => "Conflict",
            422 => "Unprocessable Entity",
            429 => "Too Many Requests",
            500 => "Internal Server Error",
            501 => "Not Implemented",
            502 => "Bad Gateway",
            503 => "Service Unavailable",
            504 => "Gateway Timeout",
            _ => "Unknown",
        }
    }
}

impl fmt::Display for StatusCode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{} {}", self.0, self.canonical_reason())
    }
}

impl From<u16> for StatusCode {
    fn from(code: u16) -> Self {
        StatusCode(code)
    }
}

/// Response body variants
#[derive(Debug)]
pub enum ResponseBody {
    /// Empty body
    Empty,
    /// Static byte array
    Bytes(Vec<u8>),
    /// UTF-8 string
    Text(String),
}

impl Clone for ResponseBody {
    fn clone(&self) -> Self {
        match self {
            ResponseBody::Empty => ResponseBody::Empty,
            ResponseBody::Bytes(bytes) => ResponseBody::Bytes(bytes.clone()),
            ResponseBody::Text(text) => ResponseBody::Text(text.clone()),
        }
    }
}

impl Response {
    /// Create new response with 200 OK status
    pub fn new() -> Self {
        Self {
            status: StatusCode::OK,
            headers: HashMap::new(),
            body: ResponseBody::Empty,
        }
    }
    
    /// Create response with specific status code
    pub fn with_status(status: StatusCode) -> Self {
        Self {
            status,
            headers: HashMap::new(),
            body: ResponseBody::Empty,
        }
    }
    
    /// Set status code
    pub fn status(mut self, status: StatusCode) -> Self {
        self.status = status;
        self
    }
    
    /// Set header
    pub fn header<K, V>(mut self, key: K, value: V) -> Self 
    where
        K: Into<String>,
        V: Into<String>,
    {
        self.headers.insert(key.into(), value.into());
        self
    }
    
    /// Set multiple headers
    pub fn headers<I, K, V>(mut self, headers: I) -> Self
    where
        I: IntoIterator<Item = (K, V)>,
        K: Into<String>,
        V: Into<String>,
    {
        for (key, value) in headers {
            self.headers.insert(key.into(), value.into());
        }
        self
    }
    
    /// Set Content-Type header
    pub fn content_type<V: Into<String>>(self, content_type: V) -> Self {
        self.header("Content-Type", content_type)
    }
    
    /// Add cache control header
    pub fn cache_control<V: Into<String>>(self, cache_control: V) -> Self {
        self.header("Cache-Control", cache_control)
    }
    
    /// Set body from bytes
    pub fn body<B: Into<Vec<u8>>>(mut self, body: B) -> Self {
        let bytes = body.into();
        self.headers.insert("Content-Length".to_string(), bytes.len().to_string());
        self.body = ResponseBody::Bytes(bytes);
        self
    }
    
    /// Set body from string (auto-detects content type)
    pub fn text<S: Into<String>>(mut self, text: S) -> Self {
        let text = text.into();
        let bytes = text.as_bytes().to_vec();
        
        self.headers.insert("Content-Length".to_string(), bytes.len().to_string());
        
        // Auto-detect content type if not already set
        if !self.headers.contains_key("Content-Type") {
            self.headers.insert("Content-Type".to_string(), "text/plain; charset=utf-8".to_string());
        }
        
        self.body = ResponseBody::Text(text);
        self
    }
    
    /// Set body as HTML
    pub fn html<S: Into<String>>(mut self, html: S) -> Self {
        let html = html.into();
        let bytes = html.as_bytes().to_vec();
        
        self.headers.insert("Content-Length".to_string(), bytes.len().to_string());
        self.headers.insert("Content-Type".to_string(), "text/html; charset=utf-8".to_string());
        
        self.body = ResponseBody::Text(html);
        self
    }
    
    /// Set response as redirect
    pub fn redirect<L: Into<String>>(self, location: L) -> Self {
        self.status(StatusCode::FOUND)
            .header("Location", location)
    }
    
    /// Set response as permanent redirect
    pub fn redirect_permanent<L: Into<String>>(self, location: L) -> Self {
        self.status(StatusCode::MOVED_PERMANENTLY)
            .header("Location", location)
    }
    
    /// Set cookie
    pub fn cookie<N, V>(self, name: N, value: V) -> Self 
    where
        N: Into<String>,
        V: Into<String>,
    {
        let cookie = format!("{}={}", name.into(), value.into());
        self.header("Set-Cookie", cookie)
    }
    
    /// Set cookie with options
    pub fn cookie_with_options<N, V>(self, name: N, value: V, options: CookieOptions) -> Self
    where
        N: Into<String>,
        V: Into<String>,
    {
        let mut cookie = format!("{}={}", name.into(), value.into());
        
        if let Some(domain) = options.domain {
            cookie.push_str(&format!("; Domain={}", domain));
        }
        if let Some(path) = options.path {
            cookie.push_str(&format!("; Path={}", path));
        }
        if let Some(max_age) = options.max_age {
            cookie.push_str(&format!("; Max-Age={}", max_age));
        }
        if options.secure {
            cookie.push_str("; Secure");
        }
        if options.http_only {
            cookie.push_str("; HttpOnly");
        }
        if let Some(same_site) = options.same_site {
            cookie.push_str(&format!("; SameSite={}", same_site));
        }
        
        self.header("Set-Cookie", cookie)
    }
    
    /// Get body size in bytes
    pub fn content_length(&self) -> Option<usize> {
        match &self.body {
            ResponseBody::Empty => Some(0),
            ResponseBody::Bytes(bytes) => Some(bytes.len()),
            ResponseBody::Text(text) => Some(text.as_bytes().len()),
        }
    }
    
    /// Convert to wire format (for sending over network)
    pub fn to_wire_format(&self) -> Vec<u8> {
        let mut response = Vec::new();
        
        // Status line
        response.extend_from_slice(b"HTTP/1.1 ");
        response.extend_from_slice(self.status.to_string().as_bytes());
        response.extend_from_slice(b"\r\n");
        
        // Headers
        for (name, value) in &self.headers {
            response.extend_from_slice(name.as_bytes());
            response.extend_from_slice(b": ");
            response.extend_from_slice(value.as_bytes());
            response.extend_from_slice(b"\r\n");
        }
        
        // Empty line between headers and body
        response.extend_from_slice(b"\r\n");
        
        // Body
        match &self.body {
            ResponseBody::Empty => {},
            ResponseBody::Bytes(bytes) => response.extend_from_slice(bytes),
            ResponseBody::Text(text) => response.extend_from_slice(text.as_bytes()),
        }
        
        response
    }
}

impl Default for Response {
    fn default() -> Self {
        Self::new()
    }
}

/// Cookie options for setting cookies
#[derive(Debug, Clone, Default)]
pub struct CookieOptions {
    /// Cookie domain
    pub domain: Option<String>,
    /// Cookie path
    pub path: Option<String>,
    /// Max age in seconds
    pub max_age: Option<u64>,
    /// Secure flag (HTTPS only)
    pub secure: bool,
    /// HttpOnly flag (no JavaScript access)
    pub http_only: bool,
    /// SameSite policy
    pub same_site: Option<String>,
}

impl CookieOptions {
    /// Create new cookie options
    pub fn new() -> Self {
        Self::default()
    }
    
    /// Set domain
    pub fn domain<S: Into<String>>(mut self, domain: S) -> Self {
        self.domain = Some(domain.into());
        self
    }
    
    /// Set path
    pub fn path<S: Into<String>>(mut self, path: S) -> Self {
        self.path = Some(path.into());
        self
    }
    
    /// Set max age
    pub fn max_age(mut self, seconds: u64) -> Self {
        self.max_age = Some(seconds);
        self
    }
    
    /// Set secure flag
    pub fn secure(mut self) -> Self {
        self.secure = true;
        self
    }
    
    /// Set http only flag
    pub fn http_only(mut self) -> Self {
        self.http_only = true;
        self
    }
    
    /// Set same site policy
    pub fn same_site<S: Into<String>>(mut self, policy: S) -> Self {
        self.same_site = Some(policy.into());
        self
    }
}

/// Convenience functions for common response types
impl Response {
    /// Create 200 OK response with text
    pub fn ok<S: Into<String>>(text: S) -> Self {
        Response::new().text(text)
    }
    
    /// Create 201 Created response
    pub fn created() -> Self {
        Response::with_status(StatusCode::CREATED)
    }
    
    /// Create 204 No Content response
    pub fn no_content() -> Self {
        Response::with_status(StatusCode::NO_CONTENT)
    }
    
    /// Create 400 Bad Request response
    pub fn bad_request<S: Into<String>>(message: S) -> Self {
        Response::with_status(StatusCode::BAD_REQUEST)
            .text(message)
    }
    
    /// Create 401 Unauthorized response
    pub fn unauthorized<S: Into<String>>(message: S) -> Self {
        Response::with_status(StatusCode::UNAUTHORIZED)
            .text(message)
    }
    
    /// Create 403 Forbidden response
    pub fn forbidden<S: Into<String>>(message: S) -> Self {
        Response::with_status(StatusCode::FORBIDDEN)
            .text(message)
    }
    
    /// Create 404 Not Found response
    pub fn not_found<S: Into<String>>(message: S) -> Self {
        Response::with_status(StatusCode::NOT_FOUND)
            .text(message)
    }
    
    /// Create 422 Unprocessable Entity response
    pub fn unprocessable_entity<S: Into<String>>(message: S) -> Self {
        Response::with_status(StatusCode::UNPROCESSABLE_ENTITY)
            .text(message)
    }
    
    /// Create 500 Internal Server Error response
    pub fn internal_server_error<S: Into<String>>(message: S) -> Self {
        Response::with_status(StatusCode::INTERNAL_SERVER_ERROR)
            .text(message)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_status_code_helpers() {
        assert_eq!(StatusCode::OK.as_u16(), 200);
        assert!(StatusCode::OK.is_success());
        assert!(!StatusCode::OK.is_client_error());
        assert!(!StatusCode::OK.is_server_error());
        
        assert!(StatusCode::NOT_FOUND.is_client_error());
        assert!(StatusCode::INTERNAL_SERVER_ERROR.is_server_error());
        
        assert_eq!(StatusCode::OK.canonical_reason(), "OK");
        assert_eq!(StatusCode::NOT_FOUND.canonical_reason(), "Not Found");
    }

    #[test]
    fn test_response_building() {
        let response = Response::new()
            .status(StatusCode::CREATED)
            .header("X-Custom", "value")
            .content_type("application/json")
            .text(r#"{"id": 1, "name": "test"}"#);
        
        assert_eq!(response.status, StatusCode::CREATED);
        assert_eq!(response.headers.get("X-Custom"), Some(&"value".to_string()));
        assert_eq!(response.headers.get("Content-Type"), Some(&"application/json".to_string()));
        
        match response.body {
            ResponseBody::Text(text) => assert!(text.contains("test")),
            _ => panic!("Expected text body"),
        }
    }

    #[test]
    fn test_convenience_responses() {
        let ok_response = Response::ok("Hello, World!");
        assert_eq!(ok_response.status, StatusCode::OK);
        
        let not_found = Response::not_found("Page not found");
        assert_eq!(not_found.status, StatusCode::NOT_FOUND);
        
        let redirect = Response::new().redirect("/login");
        assert_eq!(redirect.status, StatusCode::FOUND);
        assert_eq!(redirect.headers.get("Location"), Some(&"/login".to_string()));
    }

    #[test]
    fn test_cookie_setting() {
        // Test simple cookie
        let response1 = Response::new().cookie("session", "abc123");
        assert!(response1.headers.contains_key("Set-Cookie"));
        
        // Test cookie with options
        let response2 = Response::new()
            .cookie_with_options(
                "theme", 
                "dark", 
                CookieOptions::new()
                    .domain("example.com")
                    .path("/")
                    .max_age(3600)
                    .secure()
                    .http_only()
            );
        
        let set_cookie = response2.headers.get("Set-Cookie").unwrap();
        assert!(set_cookie.contains("theme=dark"));
        assert!(set_cookie.contains("Domain=example.com"));
        assert!(set_cookie.contains("Path=/"));
        assert!(set_cookie.contains("Max-Age=3600"));
        assert!(set_cookie.contains("Secure"));
        assert!(set_cookie.contains("HttpOnly"));
    }

    #[test]
    fn test_wire_format() {
        let response = Response::new()
            .status(StatusCode::OK)
            .header("Content-Type", "text/plain")
            .text("Hello, World!");
        
        let wire_format = response.to_wire_format();
        let response_str = String::from_utf8(wire_format).unwrap();
        
        assert!(response_str.starts_with("HTTP/1.1 200 OK"));
        assert!(response_str.contains("Content-Type: text/plain"));
        assert!(response_str.contains("Hello, World!"));
    }

    #[test]
    fn test_html_response() {
        let response = Response::new()
            .html("<h1>Hello, World!</h1>");
        
        assert_eq!(response.headers.get("Content-Type"), Some(&"text/html; charset=utf-8".to_string()));
        
        match response.body {
            ResponseBody::Text(html) => assert!(html.contains("<h1>")),
            _ => panic!("Expected text body"),
        }
    }

    #[test]
    fn test_content_length() {
        let response = Response::new().text("Hello");
        assert_eq!(response.content_length(), Some(5));
        
        let empty_response = Response::new();
        assert_eq!(empty_response.content_length(), Some(0));
    }
} 