//! Comprehensive error handling with proper context and recovery
//!
//! Type-safe error handling throughout the application with proper
//! error propagation and context preservation.

use std::io;
use thiserror::Error;

/// Zap error type covering all possible failure modes
#[derive(Debug, Error)]
pub enum ZapError {
    /// HTTP server errors
    #[error("HTTP error: {0}")]
    Http(String),

    /// Routing errors
    #[error("Routing error: {0}")]
    Routing(String),

    /// Handler execution errors
    #[error("Handler error: {0}")]
    Handler(String),

    /// IPC/Socket errors
    #[error("IPC error: {0}")]
    Ipc(String),

    /// Configuration errors
    #[error("Configuration error: {0}")]
    Config(String),

    /// I/O errors
    #[error("I/O error: {0}")]
    Io(#[from] io::Error),

    /// Serialization errors
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    /// Invalid state
    #[error("Invalid state: {0}")]
    InvalidState(String),

    /// Timeout
    #[error("Timeout: {0}")]
    Timeout(String),

    /// Internal error
    #[error("Internal error: {0}")]
    Internal(String),
}

impl From<String> for ZapError {
    fn from(msg: String) -> Self {
        Self::Internal(msg)
    }
}

impl From<&str> for ZapError {
    fn from(msg: &str) -> Self {
        Self::Internal(msg.to_string())
    }
}

/// Convenient Result type for Zap operations
pub type ZapResult<T> = Result<T, ZapError>; 