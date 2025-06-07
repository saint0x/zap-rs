//! Static file serving functionality for ZapServer

use std::collections::HashMap;
use std::path::PathBuf;
use zap_core::{Response, StatusCode};
use crate::error::ZapError;
use crate::response::ZapResponse;

/// Static file handler configuration
#[derive(Debug, Clone)]
pub struct StaticHandler {
    /// URL prefix (e.g., "/assets")
    pub prefix: String,
    /// Local directory path
    pub directory: PathBuf,
    /// Options for static serving
    pub options: StaticOptions,
}

/// Static file serving options
#[derive(Debug, Clone)]
pub struct StaticOptions {
    /// Enable directory listing
    pub directory_listing: bool,
    /// Set Cache-Control header
    pub cache_control: Option<String>,
    /// Custom headers
    pub headers: HashMap<String, String>,
    /// Enable compression
    pub compress: bool,
}

impl Default for StaticOptions {
    fn default() -> Self {
        Self {
            directory_listing: false,
            cache_control: Some("public, max-age=3600".to_string()),
            headers: HashMap::new(),
            compress: true,
        }
    }
}

impl StaticHandler {
    /// Create a new static handler
    pub fn new<P: Into<PathBuf>>(prefix: &str, directory: P) -> Self {
        Self {
            prefix: prefix.to_string(),
            directory: directory.into(),
            options: StaticOptions::default(),
        }
    }

    /// Create a new static handler with options
    pub fn new_with_options<P: Into<PathBuf>>(
        prefix: &str,
        directory: P,
        options: StaticOptions,
    ) -> Self {
        Self {
            prefix: prefix.to_string(),
            directory: directory.into(),
            options,
        }
    }

    /// Handle a static file request
    pub async fn handle(&self, path: &str) -> Result<Option<ZapResponse>, ZapError> {
        if !path.starts_with(&self.prefix) {
            return Ok(None);
        }

        let file_path = path.strip_prefix(&self.prefix).unwrap_or("");
        let full_path = self.directory.join(file_path);
        
        // Security check: ensure path doesn't escape the directory
        if !full_path.starts_with(&self.directory) {
            return Ok(Some(ZapResponse::Custom(Response::forbidden("Access denied"))));
        }
        
        // Check if file exists
        if tokio::fs::metadata(&full_path).await.is_ok() {
            // Read file and determine content type
            match tokio::fs::read(&full_path).await {
                Ok(contents) => {
                    let content_type = mime_guess::from_path(&full_path)
                        .first_or_octet_stream()
                        .to_string();
                    
                    let mut response = Response::new()
                        .status(StatusCode::OK)
                        .content_type(content_type)
                        .body(contents);
                    
                    // Add cache control if specified
                    if let Some(cache_control) = &self.options.cache_control {
                        response = response.cache_control(cache_control);
                    }
                    
                    // Add custom headers
                    for (key, value) in &self.options.headers {
                        response = response.header(key, value);
                    }
                    
                    Ok(Some(ZapResponse::Custom(response)))
                }
                Err(_) => {
                    Ok(Some(ZapResponse::Custom(Response::internal_server_error("Failed to read file"))))
                }
            }
        } else {
            Ok(None)
        }
    }
}

/// Handle static file requests from a list of handlers
pub async fn handle_static_files(
    handlers: &[StaticHandler],
    path: &str,
) -> Result<Option<ZapResponse>, ZapError> {
    for handler in handlers {
        if let Some(response) = handler.handle(path).await? {
            return Ok(Some(response));
        }
    }
    Ok(None)
} 