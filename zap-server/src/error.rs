//! Error types for ZapServer

use thiserror::Error;

/// Zap server errors
#[derive(Debug, Error)]
pub enum ZapError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("HTTP error: {0}")]
    Http(String),
    #[error("Routing error: {0}")]
    Routing(String),
    #[error("Serialization error: {0}")]
    Serialization(String),
    #[error("Handler error: {0}")]
    Handler(String),
} 