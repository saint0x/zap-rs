//! Unix Domain Socket IPC Protocol
//!
//! High-performance inter-process communication between TypeScript wrapper and Rust binary.
//! Protocol: Request/Response over Unix domain socket with newline-delimited JSON messages.

use crate::error::{ZapError, ZapResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::UnixStream;

/// Messages sent over the IPC channel
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum IpcMessage {
    /// TypeScript asks Rust to invoke a handler
    InvokeHandler {
        handler_id: String,
        request: IpcRequest,
    },

    /// TypeScript responds with handler result
    HandlerResponse {
        handler_id: String,
        status: u16,
        headers: HashMap<String, String>,
        body: String,
    },

    /// Health check ping from TypeScript
    HealthCheck,

    /// Health check response from Rust
    HealthCheckResponse,

    /// Error response
    Error {
        code: String,
        message: String,
    },
}

/// Request data sent to TypeScript handler
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpcRequest {
    /// HTTP method (GET, POST, etc.)
    pub method: String,

    /// Full path with query string
    pub path: String,

    /// Path without query string
    pub path_only: String,

    /// Query parameters
    pub query: HashMap<String, String>,

    /// Route parameters (from :id in path)
    pub params: HashMap<String, String>,

    /// HTTP headers
    pub headers: HashMap<String, String>,

    /// Request body as UTF-8 string
    pub body: String,

    /// Cookies parsed from headers
    pub cookies: HashMap<String, String>,
}

/// IPC Server - receives requests from Rust, forwards to TypeScript
pub struct IpcServer {
    socket_path: String,
}

impl IpcServer {
    /// Create a new IPC server
    pub fn new(socket_path: String) -> Self {
        Self { socket_path }
    }

    /// Start listening on the Unix socket
    pub async fn listen(&self) -> ZapResult<()> {
        // Remove existing socket file if it exists
        #[cfg(unix)]
        {
            let _ = std::fs::remove_file(&self.socket_path);
        }

        // Create Unix socket listener
        let listener = tokio::net::UnixListener::bind(&self.socket_path)
            .map_err(|e| ZapError::Ipc(format!("Failed to bind socket: {}", e)))?;

        tracing::info!("🔌 IPC server listening on {}", self.socket_path);

        // Accept connections in background
        tokio::spawn(async move {
            loop {
                match listener.accept().await {
                    Ok((stream, _)) => {
                        tokio::spawn(async move {
                            if let Err(e) = handle_ipc_connection(stream).await {
                                tracing::error!("IPC connection error: {}", e);
                            }
                        });
                    }
                    Err(e) => {
                        tracing::error!("IPC accept error: {}", e);
                    }
                }
            }
        });

        Ok(())
    }
}

/// IPC Client - connects to TypeScript's IPC server
pub struct IpcClient {
    stream: UnixStream,
}

impl IpcClient {
    /// Connect to a remote IPC server
    pub async fn connect(socket_path: &str) -> ZapResult<Self> {
        let stream = UnixStream::connect(socket_path).await.map_err(|e| {
            ZapError::Ipc(format!("Failed to connect to IPC socket: {}", e))
        })?;

        Ok(Self { stream })
    }

    /// Send a message over the IPC channel
    pub async fn send_message(&mut self, msg: IpcMessage) -> ZapResult<()> {
        let json = serde_json::to_string(&msg)?;
        let data = format!("{}\n", json); // Newline-delimited for easy framing

        self.stream
            .write_all(data.as_bytes())
            .await
            .map_err(|e| ZapError::Ipc(format!("Write error: {}", e)))?;

        self.stream.flush().await.map_err(|e| {
            ZapError::Ipc(format!("Flush error: {}", e))
        })?;

        Ok(())
    }

    /// Receive a message from the IPC channel
    pub async fn recv_message(&mut self) -> ZapResult<Option<IpcMessage>> {
        let mut buffer = String::new();
        let (reader, _writer) = self.stream.split();
        let mut buf_reader = BufReader::new(reader);

        let bytes_read = buf_reader
            .read_line(&mut buffer)
            .await
            .map_err(|e| ZapError::Ipc(format!("Read error: {}", e)))?;

        if bytes_read == 0 {
            return Ok(None); // Connection closed
        }

        let msg = serde_json::from_str(&buffer)
            .map_err(|e| ZapError::Ipc(format!("Failed to parse IPC message: {}", e)))?;

        Ok(Some(msg))
    }
}

/// Handle an IPC client connection (for future use)
async fn handle_ipc_connection(mut _stream: UnixStream) -> ZapResult<()> {
    // Currently, the Rust server only initiates connections to TypeScript
    // This handler is here for future bidirectional communication
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ipc_message_serialization() {
        let msg = IpcMessage::HealthCheck;
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("health_check"));

        let decoded: IpcMessage = serde_json::from_str(&json).unwrap();
        matches!(decoded, IpcMessage::HealthCheck);
    }

    #[test]
    fn test_ipc_request_serialization() {
        let req = IpcRequest {
            method: "GET".to_string(),
            path: "/api/users/123?sort=asc".to_string(),
            path_only: "/api/users/123".to_string(),
            query: {
                let mut m = HashMap::new();
                m.insert("sort".to_string(), "asc".to_string());
                m
            },
            params: {
                let mut m = HashMap::new();
                m.insert("id".to_string(), "123".to_string());
                m
            },
            headers: HashMap::new(),
            body: String::new(),
            cookies: HashMap::new(),
        };

        let json = serde_json::to_string(&req).unwrap();
        let decoded: IpcRequest = serde_json::from_str(&json).unwrap();

        assert_eq!(decoded.method, "GET");
        assert_eq!(decoded.path, "/api/users/123?sort=asc");
        assert_eq!(decoded.params.get("id").unwrap(), "123");
    }
}
