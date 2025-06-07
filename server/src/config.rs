//! Server configuration for ZapServer

use std::time::Duration;

/// Server configuration
#[derive(Debug, Clone)]
pub struct ServerConfig {
    /// Server port
    pub port: u16,
    /// Server hostname
    pub hostname: String,
    /// Keep-alive timeout
    pub keep_alive_timeout: Duration,
    /// Maximum request body size
    pub max_request_body_size: usize,
    /// Maximum number of headers
    pub max_headers: usize,
    /// Request timeout
    pub request_timeout: Duration,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            port: 3000,
            hostname: "127.0.0.1".to_string(),
            keep_alive_timeout: Duration::from_secs(30),
            max_request_body_size: 16 * 1024 * 1024, // 16MB
            max_headers: 100,
            request_timeout: Duration::from_secs(60),
        }
    }
}

impl ServerConfig {
    /// Create a new server configuration
    pub fn new() -> Self {
        Self::default()
    }

    /// Set the server port
    pub fn port(mut self, port: u16) -> Self {
        self.port = port;
        self
    }

    /// Set the server hostname
    pub fn hostname<S: Into<String>>(mut self, hostname: S) -> Self {
        self.hostname = hostname.into();
        self
    }

    /// Set keep-alive timeout
    pub fn keep_alive_timeout(mut self, timeout: Duration) -> Self {
        self.keep_alive_timeout = timeout;
        self
    }

    /// Set maximum request body size
    pub fn max_request_body_size(mut self, size: usize) -> Self {
        self.max_request_body_size = size;
        self
    }

    /// Set maximum number of headers
    pub fn max_headers(mut self, count: usize) -> Self {
        self.max_headers = count;
        self
    }

    /// Set request timeout
    pub fn request_timeout(mut self, timeout: Duration) -> Self {
        self.request_timeout = timeout;
        self
    }

    /// Get the socket address string
    pub fn socket_addr(&self) -> String {
        format!("{}:{}", self.hostname, self.port)
    }
} 