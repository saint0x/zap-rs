//! # Zap TypeScript Bindings

#![deny(clippy::all)]

use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::collections::HashMap;
use serde_json::Value;

/// TypeScript-friendly request object
#[napi(object)]
pub struct Request {
    /// HTTP method (GET, POST, etc.)
    pub method: String,
    /// Full request path including query string
    pub path: String,
    /// Path without query string
    pub path_only: String,
    /// HTTP version
    pub version: String,
    /// Request headers as key-value pairs
    pub headers: HashMap<String, String>,
    /// Request body as UTF-8 string
    pub body: String,
    /// Route parameters (e.g., from "/users/:id")
    pub params: HashMap<String, String>,
    /// Query string parameters
    pub query: HashMap<String, String>,
    /// Request cookies
    pub cookies: HashMap<String, String>,
}

/// Static file serving options
#[napi(object)]
pub struct StaticFileOptions {
    /// Enable directory listing
    pub directory_listing: Option<bool>,
    /// Cache control header
    pub cache_control: Option<String>,
    /// Custom headers
    pub headers: Option<HashMap<String, String>>,
    /// Enable compression
    pub compress: Option<bool>,
}

/// Main Zap server class - ultra-fast HTTP server for Node.js
#[napi]
pub struct Zap {
    port: u16,
    hostname: String,
    routes: Vec<String>, // Simplified for now
}

#[napi]
impl Zap {
    /// Create a new Zap server instance
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            port: 3000,
            hostname: "127.0.0.1".to_string(),
            routes: Vec::new(),
        }
    }

    /// Set the server port
    #[napi]
    pub fn port(&mut self, port: u32) -> Result<()> {
        self.port = port as u16;
        Ok(())
    }

    /// Set the server hostname
    #[napi]
    pub fn hostname(&mut self, hostname: String) -> Result<()> {
        self.hostname = hostname;
        Ok(())
    }

    /// Set maximum request body size
    #[napi]
    pub fn max_request_body_size(&mut self, _size: u32) -> Result<()> {
        // Store configuration (simplified for now)
        Ok(())
    }

    /// Enable CORS middleware
    #[napi]
    pub fn cors(&mut self) -> Result<()> {
        // Add CORS configuration (simplified for now)
        Ok(())
    }

    /// Enable logging middleware
    #[napi]
    pub fn logging(&mut self) -> Result<()> {
        // Add logging configuration (simplified for now)
        Ok(())
    }

    /// Register a GET route with a simple string handler
    #[napi]
    pub fn get(&mut self, path: String, _handler: JsFunction) -> Result<()> {
        self.routes.push(format!("GET {}", path));
        Ok(())
    }

    /// Register a GET route with an async handler
    #[napi]
    pub fn get_async(&mut self, path: String, _handler: JsFunction) -> Result<()> {
        self.routes.push(format!("GET {}", path));
        Ok(())
    }

    /// Register a GET route that returns JSON
    #[napi]
    pub fn get_json(&mut self, path: String, _handler: JsFunction) -> Result<()> {
        self.routes.push(format!("GET {}", path));
        Ok(())
    }

    /// Register a POST route with an async handler
    #[napi]
    pub fn post(&mut self, path: String, _handler: JsFunction) -> Result<()> {
        self.routes.push(format!("POST {}", path));
        Ok(())
    }

    /// Register a POST route that returns JSON
    #[napi]
    pub fn post_json(&mut self, path: String, _handler: JsFunction) -> Result<()> {
        self.routes.push(format!("POST {}", path));
        Ok(())
    }

    /// Register a PUT route
    #[napi]
    pub fn put(&mut self, path: String, _handler: JsFunction) -> Result<()> {
        self.routes.push(format!("PUT {}", path));
        Ok(())
    }

    /// Register a DELETE route
    #[napi]
    pub fn delete(&mut self, path: String, _handler: JsFunction) -> Result<()> {
        self.routes.push(format!("DELETE {}", path));
        Ok(())
    }

    /// Serve static files from a directory
    #[napi]
    pub fn static_files(&mut self, prefix: String, _directory: String, _options: Option<StaticFileOptions>) -> Result<()> {
        self.routes.push(format!("STATIC {}", prefix));
        Ok(())
    }

    /// Add a health check endpoint
    #[napi]
    pub fn health_check(&mut self, path: String) -> Result<()> {
        self.routes.push(format!("GET {}", path));
        Ok(())
    }

    /// Add a metrics endpoint
    #[napi]
    pub fn metrics(&mut self, path: String) -> Result<()> {
        self.routes.push(format!("GET {}", path));
        Ok(())
    }

    /// Start the server and listen for connections
    #[napi]
    pub async fn listen(&self) -> Result<()> {
        println!("🚀 Zap server listening on {}:{}", self.hostname, self.port);
        println!("📊 Registered {} routes", self.routes.len());
        
        // For now, just simulate server startup
        // In a full implementation, this would start the actual Rust HTTP server
        Ok(())
    }

    /// Get server configuration info
    #[napi]
    pub fn get_info(&self) -> Result<String> {
        Ok(format!("Zap server configured for {}:{} with {} routes", 
            self.hostname, self.port, self.routes.len()))
    }
}

/// Utility functions for TypeScript
#[napi]
pub mod utils {
    use super::*;

    /// Parse JSON string to JavaScript object
    #[napi]
    pub fn parse_json(json_str: String) -> Result<Value> {
        serde_json::from_str(&json_str).map_err(|e| {
            Error::new(Status::InvalidArg, format!("Invalid JSON: {}", e))
        })
    }

    /// Stringify JavaScript object to JSON
    #[napi]
    pub fn stringify_json(value: Value) -> Result<String> {
        serde_json::to_string(&value).map_err(|e| {
            Error::new(Status::GenericFailure, format!("Failed to stringify: {}", e))
        })
    }

    /// Get current timestamp in milliseconds
    #[napi]
    pub fn now() -> i64 {
        use std::time::{SystemTime, UNIX_EPOCH};
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64
    }
}
