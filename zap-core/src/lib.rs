//! # ZapCore
//! 
//! Ultra-fast HTTP router core with zero-allocation path matching
//! and lock-free concurrent access.
//!
//! ## Features
//! - Zero-allocation routing for static paths
//! - Radix tree for O(log n) dynamic path lookups  
//! - SIMD-optimized string matching
//! - Lock-free concurrent reads
//! - Parameter extraction with minimal copying
//! - High-performance HTTP/1.1 parsing
//! - Zero-allocation middleware system
//! - High-level Request/Response abstractions
//!
//! ## Example
//! ```rust
//! use zap_core::{Router, Method};
//!
//! let mut router = Router::new();
//! router.insert(Method::GET, "/users/:id", "get_user").unwrap();
//! router.insert(Method::POST, "/users", "create_user").unwrap();
//!
//! let (handler, params) = router.at(Method::GET, "/users/123").unwrap();
//! assert_eq!(handler, &"get_user");
//! assert_eq!(params.get("id"), Some("123"));
//! ```

use ahash::AHashMap;

pub mod method;
pub mod params;
pub mod radix;
pub mod http;
pub mod middleware;
pub mod request;
pub mod response;

pub use method::Method;
pub use params::{Params, ParamError};
pub use radix::RadixTree;
pub use http::{HttpParser, ParsedRequest, Headers, ParseError};
pub use middleware::{
    Context, ResponseBuilder, Response as MiddlewareResponse, Extensions, MiddlewareResult, 
    Middleware, MiddlewareChain, MiddlewareError,
    LoggerMiddleware, CorsMiddleware
};
pub use request::{Request, FormParseError};
pub use response::{Response, StatusCode, ResponseBody, CookieOptions};

/// Core router structure optimized for high-performance lookups
pub struct Router<T> {
    /// Separate trees for each HTTP method for maximum performance
    trees: AHashMap<Method, RadixTree<T>>,
}

impl<T> Router<T> {
    /// Create a new router instance
    #[inline]
    pub fn new() -> Self {
        Self {
            trees: AHashMap::new(),
        }
    }

    /// Insert a route with the given method, path, and handler
    /// 
    /// # Performance
    /// - O(n) insertion time where n is path length
    /// - Zero allocations for static paths
    /// - Minimal allocations for dynamic paths
    pub fn insert(&mut self, method: Method, path: &str, handler: T) -> Result<(), RouterError> {
        if path.is_empty() || !path.starts_with('/') {
            return Err(RouterError::InvalidPath(path.to_string()));
        }

        let tree = self.trees.entry(method).or_insert_with(RadixTree::new);
        tree.insert(path, handler)
    }

    /// Find a route handler for the given method and path
    /// 
    /// # Performance  
    /// - O(log n) lookup time
    /// - Zero allocations for static paths
    /// - Single allocation for parameter extraction
    /// 
    /// # Returns
    /// - `Some((handler, params))` if route found
    /// - `None` if no matching route
    #[inline]
    pub fn at<'a>(&'a self, method: Method, path: &'a str) -> Option<(&'a T, Params<'a>)> {
        self.trees.get(&method)?.find(path)
    }

    /// Get the number of routes for a specific method
    #[inline]
    pub fn len(&self, method: Method) -> usize {
        self.trees.get(&method).map_or(0, |tree| tree.len())
    }

    /// Check if router is empty
    #[inline]
    pub fn is_empty(&self) -> bool {
        self.trees.values().all(|tree| tree.is_empty())
    }

    /// Get total number of routes across all methods
    pub fn total_routes(&self) -> usize {
        self.trees.values().map(|tree| tree.len()).sum()
    }

    /// Get all registered methods
    pub fn methods(&self) -> impl Iterator<Item = Method> + '_ {
        self.trees.keys().copied()
    }
}

impl<T> Default for Router<T> {
    fn default() -> Self {
        Self::new()
    }
}

/// Router errors
#[derive(Debug, Clone, PartialEq)]
pub enum RouterError {
    /// Invalid path format
    InvalidPath(String),
    /// Duplicate route registration
    DuplicateRoute(String),
    /// Parameter parsing error
    InvalidParameter(String),
}

impl std::fmt::Display for RouterError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RouterError::InvalidPath(path) => write!(f, "Invalid path: {}", path),
            RouterError::DuplicateRoute(route) => write!(f, "Duplicate route: {}", route),
            RouterError::InvalidParameter(param) => write!(f, "Invalid parameter: {}", param),
        }
    }
}

impl std::error::Error for RouterError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_routing() {
        let mut router = Router::new();
        router.insert(Method::GET, "/", "root").unwrap();
        router.insert(Method::GET, "/users", "users").unwrap();
        router.insert(Method::POST, "/users", "create_user").unwrap();

        assert_eq!(router.at(Method::GET, "/").unwrap().0, &"root");
        assert_eq!(router.at(Method::GET, "/users").unwrap().0, &"users");
        assert_eq!(router.at(Method::POST, "/users").unwrap().0, &"create_user");
        assert!(router.at(Method::GET, "/nonexistent").is_none());
    }

    #[test]
    fn test_parameter_routing() {
        let mut router = Router::new();
        router.insert(Method::GET, "/users/:id", "get_user").unwrap();
        router.insert(Method::GET, "/users/:id/posts/:post_id", "get_post").unwrap();

        let (handler, params) = router.at(Method::GET, "/users/123").unwrap();
        assert_eq!(handler, &"get_user");
        assert_eq!(params.get("id"), Some("123"));

        let (handler, params) = router.at(Method::GET, "/users/456/posts/789").unwrap();
        assert_eq!(handler, &"get_post");
        assert_eq!(params.get("id"), Some("456"));
        assert_eq!(params.get("post_id"), Some("789"));
    }

    #[test]
    fn test_wildcard_routing() {
        let mut router = Router::new();
        router.insert(Method::GET, "/files/*filepath", "serve_file").unwrap();

        let (handler, params) = router.at(Method::GET, "/files/docs/readme.txt").unwrap();
        assert_eq!(handler, &"serve_file");
        assert_eq!(params.get("filepath"), Some("docs/readme.txt"));
    }

    #[test]
    fn test_method_separation() {
        let mut router = Router::new();
        router.insert(Method::GET, "/users", "get_users").unwrap();
        router.insert(Method::POST, "/users", "create_user").unwrap();

        assert_eq!(router.at(Method::GET, "/users").unwrap().0, &"get_users");
        assert_eq!(router.at(Method::POST, "/users").unwrap().0, &"create_user");
        assert!(router.at(Method::PUT, "/users").is_none());
    }

    #[test]
    fn test_router_stats() {
        let mut router = Router::new();
        router.insert(Method::GET, "/", "root").unwrap();
        router.insert(Method::GET, "/users", "users").unwrap();
        router.insert(Method::POST, "/users", "create").unwrap();

        assert_eq!(router.total_routes(), 3);
        assert_eq!(router.len(Method::GET), 2);
        assert_eq!(router.len(Method::POST), 1);
        assert!(!router.is_empty());

        let methods: Vec<_> = router.methods().collect();
        assert!(methods.contains(&Method::GET));
        assert!(methods.contains(&Method::POST));
    }

    #[test]
    fn test_http_parser_integration() {
        let request = b"GET /users/123 HTTP/1.1\r\nHost: example.com\r\n\r\n";
        let parser = HttpParser::new();
        let parsed = parser.parse_request(request).unwrap();

        let mut router = Router::new();
        router.insert(Method::GET, "/users/:id", "get_user").unwrap();

        let (handler, params) = router.at(parsed.method, parsed.path).unwrap();
        assert_eq!(handler, &"get_user");
        assert_eq!(params.get("id"), Some("123"));
    }

    #[tokio::test]
    async fn test_full_integration_http_router_middleware() {
        // Simulate a complete request processing pipeline
        let request_bytes = b"POST /api/users HTTP/1.1\r\nHost: api.example.com\r\nContent-Type: application/json\r\nContent-Length: 15\r\n\r\n{\"name\":\"test\"}";
        
        // Step 1: Parse HTTP request
        let parser = HttpParser::new();
        let parsed = parser.parse_request(request_bytes).unwrap();
        let body = &request_bytes[parsed.body_offset..];
        
        // Step 2: Set up router
        let mut router = Router::new();
        router.insert(Method::POST, "/api/users", "create_user").unwrap();
        router.insert(Method::GET, "/api/users/:id", "get_user").unwrap();
        
        // Step 3: Route the request
        let (handler, params) = router.at(parsed.method, parsed.path).unwrap();
        assert_eq!(handler, &"create_user");
        assert!(params.is_empty()); // No params for this route
        
        // Step 4: Create context and process through middleware
        let ctx = Context::new(&parsed, body);
        
        // Step 5: Set up middleware chain
        let middleware_chain = MiddlewareChain::new()
            .use_middleware(LoggerMiddleware::new())
            .use_middleware(CorsMiddleware::permissive());
        
        // Step 6: Execute middleware chain
        let response = middleware_chain.execute(ctx).await.unwrap();
        
        // Verify the complete pipeline worked
        assert_eq!(response.status, 200);
        assert!(response.headers.iter().any(|(k, _)| k == "Access-Control-Allow-Origin"));
        
        // Verify we can access the original request data through the context
        assert_eq!(parsed.method, Method::POST);
        assert_eq!(parsed.path, "/api/users");
        assert_eq!(parsed.headers.get("Content-Type"), Some("application/json"));
        assert_eq!(body, b"{\"name\":\"test\"}");
    }

    #[tokio::test]
    async fn test_middleware_early_termination() {
        // Test that middleware can terminate early and return a response
        let request_bytes = b"OPTIONS /api HTTP/1.1\r\nHost: example.com\r\n\r\n";
        
        let parser = HttpParser::new();
        let parsed = parser.parse_request(request_bytes).unwrap();
        let body = &request_bytes[parsed.body_offset..];
        
        let ctx = Context::new(&parsed, body);
        
        // CORS middleware should handle OPTIONS and return early
        let middleware_chain = MiddlewareChain::new()
            .use_middleware(CorsMiddleware::permissive())
            .use_middleware(LoggerMiddleware::new()); // This should not execute
        
        let response = middleware_chain.execute(ctx).await.unwrap();
        
        // Should get CORS preflight response
        assert_eq!(response.status, 200);
        assert!(response.headers.iter().any(|(k, v)| k == "Access-Control-Allow-Methods" && v.contains("OPTIONS")));
    }

    #[tokio::test]
    async fn test_complete_request_response_pipeline() {
        // Complete end-to-end test: HTTP parsing -> Routing -> Request/Response -> Middleware
        let request_bytes = b"POST /api/users/123?include=profile HTTP/1.1\r\nHost: api.example.com\r\nUser-Agent: ZapTest/1.0\r\nContent-Type: application/json\r\nContent-Length: 25\r\nCookie: session=abc123; theme=dark\r\n\r\n{\"name\":\"John Updated\"}";
        
        // Step 1: Parse HTTP request
        let parser = HttpParser::new();
        let parsed = parser.parse_request(request_bytes).unwrap();
        let body = &request_bytes[parsed.body_offset..];
        
        // Step 2: Set up router and route the request
        let mut router = Router::new();
        router.insert(Method::POST, "/api/users/:id", "update_user").unwrap();
        
        let path_for_routing = parsed.path.split('?').next().unwrap_or(parsed.path);
        let (handler, route_params) = router.at(parsed.method, path_for_routing).unwrap();
        assert_eq!(handler, &"update_user");
        
        // Step 3: Create high-level Request object
        let request = Request::new(&parsed, body, route_params);
        
        // Verify Request object functionality
        assert_eq!(request.method(), Method::POST);
        assert_eq!(request.path(), "/api/users/123?include=profile");
        assert_eq!(request.path_only(), "/api/users/123");
        assert_eq!(request.param("id"), Some("123"));
        assert_eq!(request.query("include"), Some("profile"));
        assert_eq!(request.cookie("session"), Some("abc123"));
        assert_eq!(request.cookie("theme"), Some("dark"));
        assert_eq!(request.content_type(), Some("application/json"));
        assert_eq!(request.body_string().unwrap(), r#"{"name":"John Updated"}"#);
        assert!(!request.body_is_empty());
        
        // Step 4: Create Response
        let response = Response::new()
            .status(StatusCode::OK)
            .content_type("application/json")
            .cookie("last_update", "2024-01-01")
            .text(r#"{"id": 123, "name": "John Updated", "status": "success"}"#);
        
        // Verify Response object functionality
        assert_eq!(response.status, StatusCode::OK);
        assert!(response.status.is_success());
        assert_eq!(response.headers.get("Content-Type"), Some(&"application/json".to_string()));
        assert!(response.headers.get("Set-Cookie").unwrap().contains("last_update=2024-01-01"));
        assert_eq!(response.content_length(), Some(56)); // Length of JSON response
        
        // Step 5: Test wire format generation
        let wire_format = response.to_wire_format();
        let response_str = String::from_utf8(wire_format).unwrap();
        
        assert!(response_str.contains("HTTP/1.1 200 OK"));
        assert!(response_str.contains("Content-Type: application/json"));
        assert!(response_str.contains("Set-Cookie: last_update=2024-01-01"));
        assert!(response_str.contains(r#"{"id": 123, "name": "John Updated", "status": "success"}"#));
        
        // Step 6: Demonstrate error responses
        let not_found = Response::not_found("User not found");
        assert_eq!(not_found.status, StatusCode::NOT_FOUND);
        assert!(not_found.status.is_client_error());
        
        let server_error = Response::internal_server_error("Database connection failed");
        assert_eq!(server_error.status, StatusCode::INTERNAL_SERVER_ERROR);
        assert!(server_error.status.is_server_error());
        
        // Step 7: Test redirect responses
        let redirect = Response::new().redirect("/login");
        assert_eq!(redirect.status, StatusCode::FOUND);
        assert_eq!(redirect.headers.get("Location"), Some(&"/login".to_string()));
    }
} 