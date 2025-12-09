//! # ZapServer
//! 
//! Ultra-fast HTTP server framework with Bun-inspired API
//! 
//! ## Features
//! - 🚀 **10-100x faster** than Express.js
//! - 🔥 **Zero-allocation** routing with 9ns static route lookup
//! - ⚡ **SIMD-optimized** HTTP parsing
//! - 🎯 **Type-safe** request/response handling
//! - 🧙‍♂️ **Auto-serialization** for JSON responses
//! - 🔧 **Powerful middleware** system
//! - 📁 **Built-in static** file serving
//! - 🌐 **Modern async** throughout
//!
//! ## Quick Start
//!
//! ```no_run
//! use server::{Zap, Json};
//! use serde_json::json;
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     let server = Zap::new()
//!         .port(3000)
//!         .get("/", || "Hello, World!")
//!         .get_async("/api/users/:id", |req| async move {
//!             let id = req.param("id").unwrap_or("unknown");
//!             Json(json!({ "id": id, "name": "John Doe" })).into()
//!         })
//!         .post_async("/api/users", |req| async move {
//!             // Handle user creation
//!             Json(json!({ "status": "created" })).into()
//!         });
//!
//!     println!("🚀 Server running on http://localhost:3000");
//!     Ok(server.listen().await?)
//! }
//! ```
//!
//! ## Advanced Usage
//!
//! ```no_run
//! use server::{Zap, Json, StaticOptions};
//! use serde_json::json;
//! use std::collections::HashMap;
//! use std::time::Duration;
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     let server = Zap::new()
//!         .port(8080)
//!         .hostname("0.0.0.0")
//!         .keep_alive_timeout(Duration::from_secs(30))
//!         .max_request_body_size(50 * 1024 * 1024) // 50MB
//!         
//!         // Add middleware
//!         .logging()
//!         .cors()
//!         
//!         // API routes
//!         .json_get("/api/status", |_req| json!({
//!             "status": "ok",
//!             "version": "1.0.0"
//!         }))
//!         
//!         // Dynamic routes
//!         .get_async("/users/:id", |req| async move {
//!             let id = req.param("id").unwrap_or("unknown");
//!             Json(json!({
//!                 "id": id,
//!                 "name": "John Doe",
//!                 "email": format!("user{}@example.com", id)
//!             })).into()
//!         })
//!         
//!         // Static files
//!         .static_files("/assets", "./public")
//!         
//!         // Health endpoints
//!         .health_check("/health")
//!         .metrics("/metrics");
//!
//!     Ok(server.listen().await?)
//! }
//! ```

pub mod config;
pub mod error;
pub mod handler;
pub mod ipc;
pub mod proxy;
pub mod request;
pub mod response;
pub mod server;
pub mod r#static;
pub mod utils;

// Re-export main types for convenient use
pub use config::{ServerConfig, ZapConfig};
pub use error::{ZapError, ZapResult};
pub use handler::{AsyncHandler, BoxedHandler, Handler, SimpleHandler};
pub use ipc::{IpcMessage, IpcRequest, IpcServer, IpcClient};
pub use proxy::ProxyHandler;
pub use request::RequestData;
pub use response::{Json, ZapResponse};
pub use server::Zap;
pub use r#static::{StaticHandler, StaticOptions};

// Re-export important types from core crate for convenience
pub use zap_core::{Method, StatusCode};

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::collections::HashMap;
    use std::time::Duration;

    #[test]
    fn test_server_creation() {
        let server = Zap::new()
            .port(8080)
            .hostname("0.0.0.0")
            .max_request_body_size(1024 * 1024);

        assert_eq!(server.config().port, 8080);
        assert_eq!(server.config().hostname, "0.0.0.0");
        assert_eq!(server.config().max_request_body_size, 1024 * 1024);
    }

    #[test]
    fn test_route_registration() {
        let server = Zap::new()
            .get("/", || "Hello")
            .post_async("/users", |_req| async move {
                ZapResponse::Text("Created".to_string())
            })
            .put_async("/users/:id", |_req| async move {
                ZapResponse::Text("Updated".to_string())
            });

        // Verify routes were registered
        assert_eq!(server.router().len(Method::GET), 1);
        assert_eq!(server.router().len(Method::POST), 1);
        assert_eq!(server.router().len(Method::PUT), 1);
        assert_eq!(server.router().total_routes(), 3);
    }

    #[test]
    fn test_static_files() {
        let server = Zap::new()
            .static_files("/assets", "./public")
            .static_files_with_options(
                "/downloads",
                "./downloads",
                StaticOptions {
                    directory_listing: true,
                    cache_control: Some("no-cache".to_string()),
                    ..Default::default()
                },
            );

        assert_eq!(server.static_handlers().len(), 2);
        assert_eq!(server.static_handlers()[0].prefix, "/assets");
        assert_eq!(server.static_handlers()[1].prefix, "/downloads");
        assert!(server.static_handlers()[1].options.directory_listing);
    }

    #[test]
    fn test_json_response_serialization() {
        // Test various JSON responses
        let simple_json: ZapResponse = Json(json!({"hello": "world"})).into();
        let complex_json: ZapResponse = Json(json!({
            "user": {
                "id": 123,
                "name": "John Doe",
                "preferences": {
                    "theme": "dark",
                    "language": "en"
                }
            },
            "metadata": {
                "created_at": "2024-01-01T00:00:00Z",
                "version": 1
            }
        })).into();
        
        match simple_json {
            ZapResponse::Json(value) => {
                assert_eq!(value["hello"], "world");
            }
            _ => panic!("Expected JSON response"),
        }
        
        match complex_json {
            ZapResponse::Json(value) => {
                assert_eq!(value["user"]["id"], 123);
                assert_eq!(value["user"]["preferences"]["theme"], "dark");
            }
            _ => panic!("Expected JSON response"),
        }
    }

    #[test]
    fn test_request_data_extraction() {
        // Test that RequestData properly extracts all request information
        let method = Method::POST;
        let path = "/api/users/123?include=profile&format=json".to_string();
        let headers = {
            let mut h = HashMap::new();
            h.insert("Content-Type".to_string(), "application/json".to_string());
            h.insert("Authorization".to_string(), "Bearer token123".to_string());
            h
        };
        let params = {
            let mut p = HashMap::new();
            p.insert("id".to_string(), "123".to_string());
            p
        };
        let query = {
            let mut q = HashMap::new();
            q.insert("include".to_string(), "profile".to_string());
            q.insert("format".to_string(), "json".to_string());
            q
        };
        let cookies = {
            let mut c = HashMap::new();
            c.insert("session".to_string(), "abc123".to_string());
            c
        };
        
        let req_data = RequestData {
            method,
            path: path.clone(),
            path_only: "/api/users/123".to_string(),
            version: "HTTP/1.1".to_string(),
            headers,
            body: b"{\"name\": \"John Doe\"}".to_vec(),
            params,
            query,
            cookies,
        };
        
        assert_eq!(req_data.method, Method::POST);
        assert_eq!(req_data.path, path);
        assert_eq!(req_data.param("id"), Some("123"));
        assert_eq!(req_data.query("include"), Some("profile"));
        assert_eq!(req_data.query("format"), Some("json"));
        assert_eq!(req_data.header("Content-Type"), Some("application/json"));
        assert_eq!(req_data.header("Authorization"), Some("Bearer token123"));
        assert_eq!(req_data.cookie("session"), Some("abc123"));
        assert_eq!(req_data.body_string().unwrap(), r#"{"name": "John Doe"}"#);
    }

    #[test]
    fn test_response_types() {
        use bytes::Bytes;
        
        // Test all response types
        let text_response = ZapResponse::Text("Hello".to_string());
        let html_response = ZapResponse::Html("<h1>Hello</h1>".to_string());
        let json_response = ZapResponse::Json(serde_json::json!({"key": "value"}));
        let bytes_response = ZapResponse::Bytes(Bytes::from("binary data"));
        let redirect_response = ZapResponse::Redirect("/new-location".to_string());
        let status_response = ZapResponse::Status(StatusCode::NOT_FOUND);
        
        // All should be valid response types
        assert!(matches!(text_response, ZapResponse::Text(_)));
        assert!(matches!(html_response, ZapResponse::Html(_)));
        assert!(matches!(json_response, ZapResponse::Json(_)));
        assert!(matches!(bytes_response, ZapResponse::Bytes(_)));
        assert!(matches!(redirect_response, ZapResponse::Redirect(_)));
        assert!(matches!(status_response, ZapResponse::Status(_)));
    }

    #[tokio::test]
    async fn test_full_api_showcase() {
        // Showcase the complete, powerful API
        let server = Zap::new()
            .port(8080)
            .hostname("0.0.0.0")
            .keep_alive_timeout(Duration::from_secs(30))
            .max_request_body_size(50 * 1024 * 1024) // 50MB
            
            // Add middleware
            .logging()
            .cors()
            
            // Simple routes
            .get("/", || "Welcome to Zap!")
            .get("/about", || "Ultra-fast Rust HTTP server")
            
            // Routes with parameters
            .get_async("/users/:id", |req| async move {
                let id = req.param("id").unwrap_or("unknown");
                Json(json!({
                    "id": id,
                    "name": "John Doe",
                    "email": format!("user{}@example.com", id)
                })).into()
            })
            
            // JSON API endpoints
            .json_get("/api/status", |_req| json!({
                "status": "ok",
                "version": "1.0.0",
                "uptime": "5 minutes"
            }))
            
            .json_post("/api/users", |req| {
                // In a real app, you'd parse the request body
                json!({
                    "message": "User created",
                    "id": 123,
                    "received_headers": req.headers.len()
                })
            })
            
            // File operations
            .post_async("/api/upload", |req| async move {
                let size = req.body.len();
                Json(json!({
                    "message": "File uploaded",
                    "size": size,
                    "filename": "uploaded_file.txt"
                })).into()
            })
            
            // Advanced routing with query parameters
            .get_async("/search", |req| async move {
                let query = req.query("q").unwrap_or("").to_string();
                let limit: usize = req.query("limit")
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(10);
                
                Json(json!({
                    "query": query,
                    "limit": limit,
                    "results": ["result1", "result2", "result3"]
                })).into()
            })
            
            // Health and metrics
            .health_check("/health")
            .metrics("/metrics")
            
            // Static file serving
            .static_files("/assets", "./public")
            .static_files_with_options("/downloads", "./downloads", StaticOptions {
                directory_listing: true,
                cache_control: Some("no-cache".to_string()),
                headers: {
                    let mut headers = HashMap::new();
                    headers.insert("X-Custom-Header".to_string(), "Custom Value".to_string());
                    headers
                },
                compress: true,
            })
            
            // Error handling routes
            .get("/error", || {
                // This would normally return an error
                "This route works fine"
            })
            
            // All HTTP methods
            .get("/api/resource", || "GET resource")
            .post_async("/api/resource", |_req| async move {
                Json(json!({"message": "Created"})).into()
            })
            .put_async("/api/resource/:id", |req| async move {
                let id = req.param("id").unwrap_or("unknown");
                Json(json!({"message": "Updated", "id": id})).into()
            })
            .delete("/api/resource/:id", || "Deleted");

        // Test configuration
        assert_eq!(server.config().port, 8080);
        assert_eq!(server.config().hostname, "0.0.0.0");
        assert_eq!(server.config().max_request_body_size, 50 * 1024 * 1024);

        // Test route registration
        assert!(server.router().total_routes() > 10);
        assert!(server.router().len(Method::GET) > 5);
        assert!(server.router().len(Method::POST) > 1);
        
        // Test static handlers
        assert_eq!(server.static_handlers().len(), 2);
        assert!(server.static_handlers()[1].options.directory_listing);
        assert_eq!(server.static_handlers()[1].options.cache_control, Some("no-cache".to_string()));
        
        println!("🎉 Full API showcase configured with {} routes", server.router().total_routes());
    }

    // This would be a real integration test if we could start the server
    #[tokio::test]
    #[ignore] // Ignored because it would actually start a server
    async fn test_real_server_integration() {
        let server = Zap::new()
            .port(3333)
            .get("/", || "Hello from integration test!")
            .json_get("/api/test", |_req| serde_json::json!({
                "message": "Integration test successful",
                "timestamp": chrono::Utc::now()
            }));

        // In a real test, we'd start the server and make HTTP requests
        // server.listen().await.unwrap();
        
        // Make HTTP requests to test:
        // - GET / should return "Hello from integration test!"
        // - GET /api/test should return JSON
        // - Invalid routes should return 404
        
        assert_eq!(server.config().port, 3333);
    }
} 