//! High-performance middleware system for ZapCore
//!
//! This module provides:
//! - Zero-allocation middleware composition where possible
//! - Async middleware support with minimal overhead
//! - Type-safe middleware chaining
//! - Early termination and error propagation

use crate::http::{ParsedRequest, Headers};
use crate::method::Method;
use std::future::Future;
use std::pin::Pin;

/// Request context passed through middleware chain
#[derive(Debug)]
pub struct Context<'a> {
    /// Parsed HTTP request
    pub request: &'a ParsedRequest<'a>,
    /// Request body (if available)
    pub body: &'a [u8],
    /// Response builder
    pub response: ResponseBuilder,
    /// Extension storage for middleware data
    pub extensions: Extensions,
}

impl<'a> Context<'a> {
    /// Create new context from parsed request
    pub fn new(request: &'a ParsedRequest<'a>, body: &'a [u8]) -> Self {
        Self {
            request,
            body,
            response: ResponseBuilder::new(),
            extensions: Extensions::new(),
        }
    }

    /// Get request method
    #[inline]
    pub fn method(&self) -> Method {
        self.request.method
    }

    /// Get request path
    #[inline]
    pub fn path(&self) -> &str {
        self.request.path
    }

    /// Get request headers
    #[inline]
    pub fn headers(&self) -> &Headers<'a> {
        &self.request.headers
    }

    /// Get request body as bytes
    #[inline]
    pub fn body(&self) -> &[u8] {
        self.body
    }

    /// Get request body as string (if valid UTF-8)
    pub fn body_string(&self) -> Result<&str, std::str::Utf8Error> {
        std::str::from_utf8(self.body)
    }
}

/// Response builder for constructing HTTP responses
#[derive(Debug, Clone)]
pub struct ResponseBuilder {
    /// HTTP status code
    pub status: u16,
    /// Response headers
    pub headers: Vec<(String, String)>,
    /// Response body
    pub body: Vec<u8>,
}

impl ResponseBuilder {
    /// Create new response builder with 200 OK status
    pub fn new() -> Self {
        Self {
            status: 200,
            headers: Vec::new(),
            body: Vec::new(),
        }
    }

    /// Set status code
    pub fn status(mut self, status: u16) -> Self {
        self.status = status;
        self
    }

    /// Add header
    pub fn header<K: Into<String>, V: Into<String>>(mut self, key: K, value: V) -> Self {
        self.headers.push((key.into(), value.into()));
        self
    }

    /// Set response body from bytes
    pub fn body<B: Into<Vec<u8>>>(mut self, body: B) -> Self {
        self.body = body.into();
        self
    }

    /// Set response body from string
    pub fn text<S: Into<String>>(mut self, text: S) -> Self {
        self.body = text.into().into_bytes();
        self.header("Content-Type", "text/plain; charset=utf-8")
    }

    /// Get final response
    pub fn finish(self) -> Response {
        Response {
            status: self.status,
            headers: self.headers,
            body: self.body,
        }
    }
}

impl Default for ResponseBuilder {
    fn default() -> Self {
        Self::new()
    }
}

/// Final HTTP response
#[derive(Debug, Clone)]
pub struct Response {
    /// HTTP status code
    pub status: u16,
    /// Response headers
    pub headers: Vec<(String, String)>,
    /// Response body
    pub body: Vec<u8>,
}

/// Extension storage for middleware data
#[derive(Debug, Default)]
pub struct Extensions {
    /// Type-erased storage for middleware data
    data: std::collections::HashMap<std::any::TypeId, Box<dyn std::any::Any + Send + Sync>>,
}

impl Extensions {
    /// Create new extensions storage
    pub fn new() -> Self {
        Self::default()
    }

    /// Insert typed data
    pub fn insert<T: Send + Sync + 'static>(&mut self, data: T) {
        self.data.insert(std::any::TypeId::of::<T>(), Box::new(data));
    }

    /// Get typed data
    pub fn get<T: Send + Sync + 'static>(&self) -> Option<&T> {
        self.data
            .get(&std::any::TypeId::of::<T>())
            .and_then(|data| data.downcast_ref::<T>())
    }

    /// Remove typed data
    pub fn remove<T: Send + Sync + 'static>(&mut self) -> Option<T> {
        self.data
            .remove(&std::any::TypeId::of::<T>())
            .and_then(|data| data.downcast::<T>().ok())
            .map(|boxed| *boxed)
    }
}

/// Middleware result indicating flow control
#[derive(Debug)]
pub enum MiddlewareResult {
    /// Continue to next middleware
    Continue,
    /// Stop processing and return response
    Response(Response),
}

/// Async middleware trait
pub trait Middleware: Send + Sync {
    /// Process request and return modified context and result
    fn call<'a>(
        &'a self,
        ctx: Context<'a>,
    ) -> Pin<Box<dyn Future<Output = Result<(Context<'a>, MiddlewareResult), MiddlewareError>> + Send + 'a>>;
}

/// Middleware chain for composing multiple middleware
pub struct MiddlewareChain {
    /// Ordered list of middleware
    middleware: Vec<Box<dyn Middleware>>,
}

impl MiddlewareChain {
    /// Create new empty middleware chain
    pub fn new() -> Self {
        Self {
            middleware: Vec::new(),
        }
    }

    /// Add middleware to the chain
    pub fn use_middleware<M: Middleware + 'static>(mut self, middleware: M) -> Self {
        self.middleware.push(Box::new(middleware));
        self
    }

    /// Execute middleware chain
    pub async fn execute<'a>(&self, mut ctx: Context<'a>) -> Result<Response, MiddlewareError> {
        for middleware in &self.middleware {
            let (new_ctx, result) = middleware.call(ctx).await?;
            ctx = new_ctx;
            
            match result {
                MiddlewareResult::Continue => continue,
                MiddlewareResult::Response(response) => return Ok(response),
            }
        }

        // If no middleware returned a response, return the built response
        Ok(ctx.response.finish())
    }
}

impl Default for MiddlewareChain {
    fn default() -> Self {
        Self::new()
    }
}

/// Middleware errors
#[derive(Debug, Clone)]
pub enum MiddlewareError {
    /// Internal middleware error
    InternalError(String),
    /// Bad request error
    BadRequest(String),
    /// Unauthorized error
    Unauthorized(String),
    /// Not found error
    NotFound(String),
    /// Internal server error
    InternalServerError(String),
}

impl std::fmt::Display for MiddlewareError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MiddlewareError::InternalError(msg) => write!(f, "Internal middleware error: {}", msg),
            MiddlewareError::BadRequest(msg) => write!(f, "Bad request: {}", msg),
            MiddlewareError::Unauthorized(msg) => write!(f, "Unauthorized: {}", msg),
            MiddlewareError::NotFound(msg) => write!(f, "Not found: {}", msg),
            MiddlewareError::InternalServerError(msg) => write!(f, "Internal server error: {}", msg),
        }
    }
}

impl std::error::Error for MiddlewareError {}

/// Built-in logger middleware
pub struct LoggerMiddleware {
    /// Log format string
    #[allow(dead_code)]
    format: String,
}

impl LoggerMiddleware {
    /// Create new logger middleware with default format
    pub fn new() -> Self {
        Self {
            format: "{method} {path} {status} {duration}ms".to_string(),
        }
    }

    /// Create logger with custom format
    pub fn with_format<S: Into<String>>(format: S) -> Self {
        Self {
            format: format.into(),
        }
    }
}

impl Default for LoggerMiddleware {
    fn default() -> Self {
        Self::new()
    }
}

impl Middleware for LoggerMiddleware {
    fn call<'a>(
        &'a self,
        ctx: Context<'a>,
    ) -> Pin<Box<dyn Future<Output = Result<(Context<'a>, MiddlewareResult), MiddlewareError>> + Send + 'a>> {
        Box::pin(async move {
            let start = std::time::Instant::now();
            
            // Store start time in extensions for later use
            let mut new_ctx = ctx;
            new_ctx.extensions.insert(start);
            
            // Log the request
            println!("{} {} - Starting", new_ctx.method(), new_ctx.path());
            
            Ok((new_ctx, MiddlewareResult::Continue))
        })
    }
}

/// Built-in CORS middleware
pub struct CorsMiddleware {
    /// Allowed origins
    origins: Vec<String>,
    /// Allowed methods
    #[allow(dead_code)]
    methods: Vec<Method>,
    /// Allowed headers
    #[allow(dead_code)]
    headers: Vec<String>,
}

impl CorsMiddleware {
    /// Create permissive CORS middleware
    pub fn permissive() -> Self {
        Self {
            origins: vec!["*".to_string()],
            methods: vec![Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::PATCH, Method::OPTIONS],
            headers: vec!["*".to_string()],
        }
    }

    /// Create CORS middleware with specific origins
    pub fn with_origins<I: IntoIterator<Item = S>, S: Into<String>>(origins: I) -> Self {
        Self {
            origins: origins.into_iter().map(|s| s.into()).collect(),
            methods: vec![Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::PATCH, Method::OPTIONS],
            headers: vec!["*".to_string()],
        }
    }
}

impl Middleware for CorsMiddleware {
    fn call<'a>(
        &'a self,
        ctx: Context<'a>,
    ) -> Pin<Box<dyn Future<Output = Result<(Context<'a>, MiddlewareResult), MiddlewareError>> + Send + 'a>> {
        Box::pin(async move {
            // Handle preflight requests
            if ctx.method() == Method::OPTIONS {
                let response = ResponseBuilder::new()
                    .status(200)
                    .header("Access-Control-Allow-Origin", &self.origins[0])
                    .header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
                    .header("Access-Control-Allow-Headers", "Content-Type, Authorization")
                    .body(Vec::new())
                    .finish();
                
                return Ok((ctx, MiddlewareResult::Response(response)));
            }

            // Add CORS headers to response
            let mut new_ctx = ctx;
            new_ctx.response = new_ctx.response
                .clone()
                .header("Access-Control-Allow-Origin", &self.origins[0]);

            Ok((new_ctx, MiddlewareResult::Continue))
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{Method, HttpParser};

    #[tokio::test]
    async fn test_context_creation() {
        let request_bytes = b"GET /hello HTTP/1.1\r\nHost: example.com\r\n\r\ntest body";
        let parser = HttpParser::new();
        let parsed = parser.parse_request(request_bytes).unwrap();
        let body = &request_bytes[parsed.body_offset..];
        
        let ctx = Context::new(&parsed, body);
        
        assert_eq!(ctx.method(), Method::GET);
        assert_eq!(ctx.path(), "/hello");
        assert_eq!(ctx.body(), b"test body");
        assert_eq!(ctx.body_string().unwrap(), "test body");
    }

    #[tokio::test]
    async fn test_response_builder() {
        let response = ResponseBuilder::new()
            .status(201)
            .header("Content-Type", "application/json")
            .text("Hello, World!")
            .finish();
        
        assert_eq!(response.status, 201);
        assert_eq!(response.body, b"Hello, World!");
        assert!(response.headers.contains(&("Content-Type".to_string(), "text/plain; charset=utf-8".to_string())));
    }

    #[tokio::test]
    async fn test_extensions() {
        let mut extensions = Extensions::new();
        
        extensions.insert(42u32);
        extensions.insert("hello".to_string());
        
        assert_eq!(extensions.get::<u32>(), Some(&42));
        assert_eq!(extensions.get::<String>(), Some(&"hello".to_string()));
        assert_eq!(extensions.get::<i32>(), None);
        
        let removed: Option<u32> = extensions.remove();
        assert_eq!(removed, Some(42));
        assert_eq!(extensions.get::<u32>(), None);
    }

    #[tokio::test]
    async fn test_logger_middleware() {
        let request_bytes = b"GET /test HTTP/1.1\r\nHost: example.com\r\n\r\n";
        let parser = HttpParser::new();
        let parsed = parser.parse_request(request_bytes).unwrap();
        let body = &request_bytes[parsed.body_offset..];
        
        let ctx = Context::new(&parsed, body);
        let logger = LoggerMiddleware::new();
        
        let (new_ctx, result) = logger.call(ctx).await.unwrap();
        assert!(matches!(result, MiddlewareResult::Continue));
        
        // Check that start time was stored
        assert!(new_ctx.extensions.get::<std::time::Instant>().is_some());
    }

    #[tokio::test]
    async fn test_cors_middleware_preflight() {
        let request_bytes = b"OPTIONS /api HTTP/1.1\r\nHost: example.com\r\n\r\n";
        let parser = HttpParser::new();
        let parsed = parser.parse_request(request_bytes).unwrap();
        let body = &request_bytes[parsed.body_offset..];
        
        let ctx = Context::new(&parsed, body);
        let cors = CorsMiddleware::permissive();
        
        let (_new_ctx, result) = cors.call(ctx).await.unwrap();
        
        match result {
            MiddlewareResult::Response(response) => {
                assert_eq!(response.status, 200);
                assert!(response.headers.iter().any(|(k, _)| k == "Access-Control-Allow-Origin"));
            }
            _ => panic!("Expected response for OPTIONS request"),
        }
    }

    #[tokio::test]
    async fn test_middleware_chain() {
        let request_bytes = b"GET /test HTTP/1.1\r\nHost: example.com\r\n\r\n";
        let parser = HttpParser::new();
        let parsed = parser.parse_request(request_bytes).unwrap();
        let body = &request_bytes[parsed.body_offset..];
        
        let ctx = Context::new(&parsed, body);
        
        let chain = MiddlewareChain::new()
            .use_middleware(LoggerMiddleware::new())
            .use_middleware(CorsMiddleware::permissive());
        
        let response = chain.execute(ctx).await.unwrap();
        
        // Should have CORS headers added
        assert!(response.headers.iter().any(|(k, _)| k == "Access-Control-Allow-Origin"));
    }
} 