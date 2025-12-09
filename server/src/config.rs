//! Server configuration
//!
//! Comprehensive configuration system supporting:
//! - JSON config files
//! - Environment variables
//! - CLI argument overrides

use serde::{Deserialize, Serialize};
use std::time::Duration;
use crate::error::{ZapError, ZapResult};

/// Complete Zap server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZapConfig {
    /// HTTP server port
    pub port: u16,

    /// HTTP server hostname
    pub hostname: String,

    /// Unix domain socket path for IPC with TypeScript
    pub ipc_socket_path: String,

    /// Maximum request body size in bytes (default: 16MB)
    #[serde(default = "default_max_body_size")]
    pub max_request_body_size: usize,

    /// Request timeout in seconds
    #[serde(default = "default_request_timeout")]
    pub request_timeout_secs: u64,

    /// Keep-alive timeout in seconds
    #[serde(default = "default_keepalive_timeout")]
    pub keepalive_timeout_secs: u64,

    /// Route configurations
    #[serde(default)]
    pub routes: Vec<RouteConfig>,

    /// Static file configurations
    #[serde(default)]
    pub static_files: Vec<StaticFileConfig>,

    /// Middleware settings
    #[serde(default)]
    pub middleware: MiddlewareConfig,

    /// Health check endpoint path
    #[serde(default = "default_health_path")]
    pub health_check_path: String,

    /// Metrics endpoint path
    #[serde(default)]
    pub metrics_path: Option<String>,
}

/// Route configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteConfig {
    /// HTTP method: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS
    pub method: String,

    /// URL path pattern: /api/users/:id
    pub path: String,

    /// Handler ID: handler_0, handler_1, etc.
    pub handler_id: String,

    /// Is this a TypeScript handler (needs IPC), or Rust native?
    #[serde(default = "default_is_typescript")]
    pub is_typescript: bool,
}

/// Static file serving configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StaticFileConfig {
    /// URL prefix: /static
    pub prefix: String,

    /// Directory path: ./public
    pub directory: String,

    /// Additional options
    #[serde(default)]
    pub options: StaticFileOptions,
}

/// Static file serving options
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StaticFileOptions {
    /// Cache control header value
    #[serde(default)]
    pub cache_control: Option<String>,

    /// Enable gzip compression
    #[serde(default)]
    pub enable_gzip: bool,
}

/// Middleware configuration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MiddlewareConfig {
    /// Enable CORS middleware
    #[serde(default)]
    pub enable_cors: bool,

    /// Enable request logging middleware
    #[serde(default)]
    pub enable_logging: bool,

    /// Enable response compression
    #[serde(default)]
    pub enable_compression: bool,
}

impl Default for ZapConfig {
    fn default() -> Self {
        Self {
            port: 3000,
            hostname: "127.0.0.1".to_string(),
            ipc_socket_path: "/tmp/zap.sock".to_string(),
            max_request_body_size: 16 * 1024 * 1024, // 16MB
            request_timeout_secs: 30,
            keepalive_timeout_secs: 75,
            routes: Vec::new(),
            static_files: Vec::new(),
            middleware: MiddlewareConfig::default(),
            health_check_path: "/health".to_string(),
            metrics_path: None,
        }
    }
}

impl ZapConfig {
    /// Create a new config with defaults
    pub fn new() -> Self {
        Self::default()
    }

    /// Load configuration from a JSON file
    pub fn from_file(path: &str) -> ZapResult<Self> {
        let content = std::fs::read_to_string(path)
            .map_err(|e| ZapError::Config(format!("Failed to read config file: {}", e)))?;

        let config = serde_json::from_str(&content)
            .map_err(|e| ZapError::Config(format!("Failed to parse config JSON: {}", e)))?;

        Ok(config)
    }

    /// Validate configuration
    pub async fn validate(&self) -> ZapResult<()> {
        if self.port == 0 {
            return Err(ZapError::Config("Port must be > 0".to_string()));
        }
        if self.hostname.is_empty() {
            return Err(ZapError::Config("Hostname cannot be empty".to_string()));
        }
        if self.ipc_socket_path.is_empty() {
            return Err(ZapError::Config("IPC socket path cannot be empty".to_string()));
        }
        if self.request_timeout_secs == 0 {
            return Err(ZapError::Config("Request timeout must be > 0".to_string()));
        }
        Ok(())
    }

    /// Get socket address as string
    pub fn socket_addr(&self) -> String {
        format!("{}:{}", self.hostname, self.port)
    }

    /// Get request timeout as Duration
    pub fn request_timeout(&self) -> Duration {
        Duration::from_secs(self.request_timeout_secs)
    }

    /// Get keep-alive timeout as Duration
    pub fn keepalive_timeout(&self) -> Duration {
        Duration::from_secs(self.keepalive_timeout_secs)
    }
}

// Default function values for serde
fn default_max_body_size() -> usize { 16 * 1024 * 1024 }
fn default_request_timeout() -> u64 { 30 }
fn default_keepalive_timeout() -> u64 { 75 }
fn default_health_path() -> String { "/health".to_string() }
fn default_is_typescript() -> bool { true }

/// Legacy ServerConfig for compatibility
#[derive(Debug, Clone)]
pub struct ServerConfig {
    pub port: u16,
    pub hostname: String,
    pub keep_alive_timeout: Duration,
    pub max_request_body_size: usize,
    pub max_headers: usize,
    pub request_timeout: Duration,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            port: 3000,
            hostname: "127.0.0.1".to_string(),
            keep_alive_timeout: Duration::from_secs(75),
            max_request_body_size: 16 * 1024 * 1024,
            max_headers: 100,
            request_timeout: Duration::from_secs(30),
        }
    }
}

impl ServerConfig {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn port(mut self, port: u16) -> Self {
        self.port = port;
        self
    }

    pub fn hostname<S: Into<String>>(mut self, hostname: S) -> Self {
        self.hostname = hostname.into();
        self
    }

    pub fn keep_alive_timeout(mut self, timeout: Duration) -> Self {
        self.keep_alive_timeout = timeout;
        self
    }

    pub fn max_request_body_size(mut self, size: usize) -> Self {
        self.max_request_body_size = size;
        self
    }

    pub fn max_headers(mut self, count: usize) -> Self {
        self.max_headers = count;
        self
    }

    pub fn request_timeout(mut self, timeout: Duration) -> Self {
        self.request_timeout = timeout;
        self
    }

    pub fn socket_addr(&self) -> String {
        format!("{}:{}", self.hostname, self.port)
    }
} 