//! Core ZapServer implementation

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper::{body::Incoming, Request as HyperRequest, Response as HyperResponse};
use hyper_util::rt::TokioIo;
use serde::Serialize;
use tokio::net::TcpListener;
use tracing::{debug, error, info};

use zap_core::{
    HttpParser, Method, MiddlewareChain, Request, Router,
};

use crate::config::{ServerConfig, ZapConfig};
use crate::error::{ZapError, ZapResult};
use crate::handler::{AsyncHandler, BoxedHandler, Handler, SimpleHandler};
use crate::proxy::ProxyHandler;
use crate::request::RequestData;
use crate::response::{Json, ZapResponse};
use crate::r#static::{handle_static_files, StaticHandler, StaticOptions};
use crate::utils::convert_method;

/// Main Zap server - the entry point for building high-performance web applications
pub struct Zap {
    /// Server configuration
    config: ServerConfig,
    /// HTTP router for handling requests
    router: Router<BoxedHandler>,
    /// Middleware chain
    middleware: MiddlewareChain,
    /// Static file handlers
    static_handlers: Vec<StaticHandler>,
}

impl Zap {
    /// Create a new Zap server instance
    pub fn new() -> Self {
        Self {
            config: ServerConfig::default(),
            router: Router::new(),
            middleware: MiddlewareChain::new(),
            static_handlers: Vec::new(),
        }
    }

    /// Set the server port
    pub fn port(mut self, port: u16) -> Self {
        self.config.port = port;
        self
    }

    /// Set the server hostname
    pub fn hostname<S: Into<String>>(mut self, hostname: S) -> Self {
        self.config.hostname = hostname.into();
        self
    }

    /// Set keep-alive timeout
    pub fn keep_alive_timeout(mut self, timeout: Duration) -> Self {
        self.config.keep_alive_timeout = timeout;
        self
    }

    /// Set maximum request body size
    pub fn max_request_body_size(mut self, size: usize) -> Self {
        self.config.max_request_body_size = size;
        self
    }

    /// Set request timeout
    pub fn request_timeout(mut self, timeout: Duration) -> Self {
        self.config.request_timeout = timeout;
        self
    }

    /// Add middleware to the chain
    pub fn use_middleware<M>(mut self, middleware: M) -> Self
    where
        M: zap_core::Middleware + 'static,
    {
        self.middleware = self.middleware.use_middleware(middleware);
        self
    }

    /// Register a GET route
    pub fn get<H>(mut self, path: &str, handler: H) -> Self
    where
        H: Handler + Send + Sync + 'static,
    {
        self.router
            .insert(Method::GET, path, Box::new(handler))
            .unwrap_or_else(|e| panic!("Failed to register GET route '{}': {}", path, e));
        self
    }

    /// Register a GET route with a simple closure
    pub fn get_simple<F>(mut self, path: &str, handler: F) -> Self
    where
        F: Fn() -> String + Send + Sync + 'static,
    {
        self.router
            .insert(Method::GET, path, Box::new(SimpleHandler::new(handler)))
            .unwrap_or_else(|e| panic!("Failed to register GET route '{}': {}", path, e));
        self
    }

    /// Register a GET route with an async handler
    pub fn get_async<F, Fut>(mut self, path: &str, handler: F) -> Self
    where
        F: Fn(RequestData) -> Fut + Send + Sync + 'static,
        Fut: std::future::Future<Output = ZapResponse> + Send + 'static,
    {
        self.router
            .insert(Method::GET, path, Box::new(AsyncHandler::new(handler)))
            .unwrap_or_else(|e| panic!("Failed to register GET route '{}': {}", path, e));
        self
    }

    /// Register a POST route
    pub fn post<H>(mut self, path: &str, handler: H) -> Self
    where
        H: Handler + Send + Sync + 'static,
    {
        self.router
            .insert(Method::POST, path, Box::new(handler))
            .unwrap_or_else(|e| panic!("Failed to register POST route '{}': {}", path, e));
        self
    }

    /// Register a POST route with an async handler
    pub fn post_async<F, Fut>(mut self, path: &str, handler: F) -> Self
    where
        F: Fn(RequestData) -> Fut + Send + Sync + 'static,
        Fut: std::future::Future<Output = ZapResponse> + Send + 'static,
    {
        self.router
            .insert(Method::POST, path, Box::new(AsyncHandler::new(handler)))
            .unwrap_or_else(|e| panic!("Failed to register POST route '{}': {}", path, e));
        self
    }

    /// Register a PUT route
    pub fn put<H>(mut self, path: &str, handler: H) -> Self
    where
        H: Handler + Send + Sync + 'static,
    {
        self.router
            .insert(Method::PUT, path, Box::new(handler))
            .unwrap_or_else(|e| panic!("Failed to register PUT route '{}': {}", path, e));
        self
    }

    /// Register a PUT route with an async handler
    pub fn put_async<F, Fut>(mut self, path: &str, handler: F) -> Self
    where
        F: Fn(RequestData) -> Fut + Send + Sync + 'static,
        Fut: std::future::Future<Output = ZapResponse> + Send + 'static,
    {
        self.router
            .insert(Method::PUT, path, Box::new(AsyncHandler::new(handler)))
            .unwrap_or_else(|e| panic!("Failed to register PUT route '{}': {}", path, e));
        self
    }

    /// Register a PATCH route
    pub fn patch<H>(mut self, path: &str, handler: H) -> Self
    where
        H: Handler + Send + Sync + 'static,
    {
        self.router
            .insert(Method::PATCH, path, Box::new(handler))
            .unwrap_or_else(|e| panic!("Failed to register PATCH route '{}': {}", path, e));
        self
    }

    /// Register a DELETE route
    pub fn delete<H>(mut self, path: &str, handler: H) -> Self
    where
        H: Handler + Send + Sync + 'static,
    {
        self.router
            .insert(Method::DELETE, path, Box::new(handler))
            .unwrap_or_else(|e| panic!("Failed to register DELETE route '{}': {}", path, e));
        self
    }

    /// Register an OPTIONS route
    pub fn options<H>(mut self, path: &str, handler: H) -> Self
    where
        H: Handler + Send + Sync + 'static,
    {
        self.router
            .insert(Method::OPTIONS, path, Box::new(handler))
            .unwrap_or_else(|e| panic!("Failed to register OPTIONS route '{}': {}", path, e));
        self
    }

    /// Register a HEAD route
    pub fn head<H>(mut self, path: &str, handler: H) -> Self
    where
        H: Handler + Send + Sync + 'static,
    {
        self.router
            .insert(Method::HEAD, path, Box::new(handler))
            .unwrap_or_else(|e| panic!("Failed to register HEAD route '{}': {}", path, e));
        self
    }

    /// Register routes for all HTTP methods
    pub fn all<H>(mut self, path: &str, handler: H) -> Self
    where
        H: Handler + Send + Sync + Clone + 'static,
    {
        for method in [
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
            Method::HEAD,
        ] {
            self.router
                .insert(method, path, Box::new(handler.clone()))
                .unwrap_or_else(|e| {
                    panic!("Failed to register {} route '{}': {}", method, path, e)
                });
        }
        self
    }

    /// Serve static files from a directory
    pub fn static_files<P: Into<std::path::PathBuf>>(mut self, prefix: &str, directory: P) -> Self {
        self.static_handlers.push(StaticHandler::new(prefix, directory));
        self
    }

    /// Serve static files with custom options
    pub fn static_files_with_options<P: Into<std::path::PathBuf>>(
        mut self,
        prefix: &str,
        directory: P,
        options: StaticOptions,
    ) -> Self {
        self.static_handlers.push(StaticHandler::new_with_options(prefix, directory, options));
        self
    }

    /// Register a JSON API endpoint with automatic serialization
    pub fn json_get<F, T>(self, path: &str, handler: F) -> Self
    where
        F: Fn(RequestData) -> T + Send + Sync + 'static,
        T: Serialize + Send + 'static,
    {
        self.get_async(path, move |req| {
            let result = handler(req);
            async move { Json(result).into() }
        })
    }

    /// Register a JSON POST endpoint
    pub fn json_post<F, T>(self, path: &str, handler: F) -> Self
    where
        F: Fn(RequestData) -> T + Send + Sync + 'static,
        T: Serialize + Send + 'static,
    {
        self.post_async(path, move |req| {
            let result = handler(req);
            async move { Json(result).into() }
        })
    }

    /// Add CORS middleware with permissive settings
    pub fn cors(self) -> Self {
        self.use_middleware(zap_core::CorsMiddleware::permissive())
    }

    /// Add logging middleware
    pub fn logging(self) -> Self {
        self.use_middleware(zap_core::LoggerMiddleware::new())
    }

    /// Health check endpoint
    pub fn health_check(self, path: &str) -> Self {
        self.get(path, || "OK")
    }

    /// Metrics endpoint (basic)
    pub fn metrics(self, path: &str) -> Self {
        self.get_async(path, |_req| async move {
            let metrics = serde_json::json!({
                "status": "healthy",
                "timestamp": chrono::Utc::now().to_rfc3339(),
                "memory_usage": "TODO",
                "uptime": "TODO"
            });
            Json(metrics).into()
        })
    }

    /// Start the server and listen for connections
    pub async fn listen(self) -> Result<(), ZapError> {
        let addr = self.config.socket_addr();
        let socket_addr: SocketAddr = addr.parse().map_err(|e| {
            ZapError::Http(format!("Invalid address '{}': {}", addr, e))
        })?;

        let listener = TcpListener::bind(socket_addr).await?;
        
        info!("🚀 Zap server listening on http://{}", addr);
        info!("📊 Router contains {} routes", self.router.total_routes());
        
        let server = Arc::new(self);

        loop {
            let (stream, remote_addr) = listener.accept().await?;
            let server = server.clone();
            
            tokio::spawn(async move {
                let io = TokioIo::new(stream);
                
                let service = service_fn(move |req| {
                    let server = server.clone();
                    async move {
                        server.handle_request(req, remote_addr).await
                    }
                });

                if let Err(err) = http1::Builder::new()
                    .serve_connection(io, service)
                    .await
                {
                    error!("Error serving connection: {:?}", err);
                }
            });
        }
    }

    /// Handle an individual HTTP request
    async fn handle_request(
        &self,
        hyper_req: HyperRequest<Incoming>,
        remote_addr: SocketAddr,
    ) -> Result<HyperResponse<String>, hyper::Error> {
        let response = match self.process_request(hyper_req, remote_addr).await {
            Ok(zap_response) => zap_response.to_hyper_response(),
            Err(error) => {
                error!("Request processing error: {}", error);
                hyper::Response::builder()
                    .status(500)
                    .body("Internal Server Error".to_string())
                    .unwrap()
            }
        };

        Ok(response)
    }

    /// Process the request through our complete pipeline
    async fn process_request(
        &self,
        hyper_req: HyperRequest<Incoming>,
        _remote_addr: SocketAddr,
    ) -> Result<ZapResponse, ZapError> {
        // Step 1: Convert Hyper request to raw bytes
        let (parts, _body) = hyper_req.into_parts();
        
        // For now, use empty body to get compilation working
        // TODO: Implement proper body collection
        let body_bytes = Vec::new();

        // Convert method
        let method = convert_method(&parts.method)?;

        // Step 2: Reconstruct HTTP request bytes for our parser  
        let mut request_bytes = Vec::new();
        request_bytes.extend_from_slice(format!("{} {} {:?}\r\n", parts.method, parts.uri, parts.version).as_bytes());
        
        for (name, value) in &parts.headers {
            request_bytes.extend_from_slice(name.as_str().as_bytes());
            request_bytes.extend_from_slice(b": ");
            request_bytes.extend_from_slice(value.as_bytes());
            request_bytes.extend_from_slice(b"\r\n");
        }
        request_bytes.extend_from_slice(b"\r\n");
        request_bytes.extend_from_slice(&body_bytes);

        // Step 3: Parse using our fast HTTP parser
        let parser = HttpParser::new();
        let parsed = parser.parse_request(&request_bytes)
            .map_err(|e| ZapError::Http(format!("HTTP parsing failed: {:?}", e)))?;

        // Step 4: Check for static file handlers first
        let path_for_routing = parsed.path.split('?').next().unwrap_or(parsed.path);
        
        // Check static handlers
        if let Some(static_response) = handle_static_files(&self.static_handlers, path_for_routing).await? {
            return Ok(static_response);
        }

        // Step 5: Route the request using our fast router
        let (handler, route_params) = self.router.at(method, path_for_routing)
            .ok_or_else(|| ZapError::Routing(format!("No route found for {} {}", method, path_for_routing)))?;

        // Step 6: Create Request object
        let body_start = &request_bytes[parsed.body_offset..];
        let request = Request::new(&parsed, body_start, route_params);

        // Step 7: Execute the handler (middleware is handled separately in a real implementation)
        let response = handler.handle(request).await
            .map_err(|e| ZapError::Handler(format!("Handler execution failed: {}", e)))?;

        Ok(response)
    }

    /// Get router reference for testing
    pub fn router(&self) -> &Router<BoxedHandler> {
        &self.router
    }

    /// Get config reference for testing
    pub fn config(&self) -> &ServerConfig {
        &self.config
    }

    /// Get static handlers reference for testing
    pub fn static_handlers(&self) -> &[StaticHandler] {
        &self.static_handlers
    }

    /// Create a Zap server from comprehensive configuration
    ///
    /// This method is used by the binary entry point to load configuration
    /// from JSON and build the complete server with all routes and middleware.
    pub async fn from_config(config: ZapConfig) -> ZapResult<Self> {
        info!("🔧 Building Zap server from configuration");

        let mut server = Self {
            config: ServerConfig::new()
                .port(config.port)
                .hostname(config.hostname.clone())
                .max_request_body_size(config.max_request_body_size)
                .request_timeout(Duration::from_secs(config.request_timeout_secs))
                .keep_alive_timeout(Duration::from_secs(config.keepalive_timeout_secs)),
            router: Router::new(),
            middleware: MiddlewareChain::new(),
            static_handlers: Vec::new(),
        };

        // Add middleware
        if config.middleware.enable_cors {
            info!("✓ CORS middleware enabled");
            server = server.cors();
        }

        if config.middleware.enable_logging {
            info!("✓ Logging middleware enabled");
            server = server.logging();
        }

        // Register all routes from configuration
        for route_cfg in &config.routes {
            let method = route_cfg.method.to_uppercase();
            let method_enum = match method.as_str() {
                "GET" => Method::GET,
                "POST" => Method::POST,
                "PUT" => Method::PUT,
                "DELETE" => Method::DELETE,
                "PATCH" => Method::PATCH,
                "HEAD" => Method::HEAD,
                "OPTIONS" => Method::OPTIONS,
                _ => {
                    return Err(ZapError::Config(format!(
                        "Unknown HTTP method: {}",
                        method
                    )))
                }
            };

            if route_cfg.is_typescript {
                // TypeScript handler - use proxy
                let proxy = ProxyHandler::with_timeout(
                    route_cfg.handler_id.clone(),
                    config.ipc_socket_path.clone(),
                    config.request_timeout_secs,
                );
                server.router.insert(method_enum, &route_cfg.path, Box::new(proxy))
                    .map_err(|e| ZapError::Config(format!(
                        "Failed to register route {}: {}",
                        route_cfg.path, e
                    )))?;
                debug!("✓ Registered {} {} -> {} (TypeScript)", method, route_cfg.path, route_cfg.handler_id);
            }
            // Rust handlers would be added here if needed
        }

        // Register static files
        for static_cfg in &config.static_files {
            server = server.static_files(&static_cfg.prefix, &static_cfg.directory);
            info!(
                "✓ Static files: {} -> {}",
                static_cfg.prefix, static_cfg.directory
            );
        }

        // Add health check
        if !config.health_check_path.is_empty() {
            server = server.health_check(&config.health_check_path);
            info!("✓ Health check: {}", config.health_check_path);
        }

        // Add metrics endpoint if configured
        if let Some(metrics_path) = config.metrics_path {
            server = server.metrics(&metrics_path);
            info!("✓ Metrics endpoint: {}", metrics_path);
        }

        info!("✅ Server configured with {} routes", server.router.total_routes());

        Ok(server)
    }

    /// Graceful shutdown of the server
    pub async fn shutdown(&self) -> ZapResult<()> {
        info!("🛑 Initiating graceful shutdown");
        // Cleanup can be added here if needed
        Ok(())
    }
}

impl Default for Zap {
    fn default() -> Self {
        Self::new()
    }
} 