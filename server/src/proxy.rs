//! Proxy handler that forwards requests to TypeScript via IPC
//!
//! When a TypeScript handler is routed, this handler:
//! 1. Serializes the request to IPC protocol
//! 2. Sends to TypeScript via Unix socket
//! 3. Waits for response with timeout
//! 4. Converts response back to HTTP

use crate::error::{ZapError, ZapResult};
use crate::handler::Handler;
use crate::ipc::{IpcClient, IpcMessage, IpcRequest};
use crate::response::ZapResponse;
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use tracing::{debug, error, warn};
use zap_core::Request;

/// Handler that proxies requests to TypeScript via IPC
pub struct ProxyHandler {
    /// Unique identifier for this handler
    handler_id: String,

    /// Path to the Unix socket for IPC communication
    ipc_socket_path: Arc<String>,

    /// Request timeout in seconds
    timeout_secs: u64,
}

impl ProxyHandler {
    /// Create a new proxy handler
    pub fn new(handler_id: String, ipc_socket_path: String) -> Self {
        Self {
            handler_id,
            ipc_socket_path: Arc::new(ipc_socket_path),
            timeout_secs: 30,
        }
    }

    /// Create with custom timeout
    pub fn with_timeout(
        handler_id: String,
        ipc_socket_path: String,
        timeout_secs: u64,
    ) -> Self {
        Self {
            handler_id,
            ipc_socket_path: Arc::new(ipc_socket_path),
            timeout_secs,
        }
    }

    /// Make an IPC request to the TypeScript handler
    async fn invoke_handler(&self, request: IpcRequest) -> ZapResult<IpcMessage> {
        debug!(
            "📤 Invoking TypeScript handler: {} for {} {}",
            self.handler_id, request.method, request.path
        );

        // Connect to TypeScript's IPC server
        let mut client =
            IpcClient::connect(self.ipc_socket_path.as_str())
                .await
                .map_err(|e| {
                    error!("Failed to connect to IPC: {}", e);
                    e
                })?;

        // Create invocation message
        let msg = IpcMessage::InvokeHandler {
            handler_id: self.handler_id.clone(),
            request,
        };

        // Send the invocation
        client.send_message(msg).await.map_err(|e| {
            error!("Failed to send IPC message: {}", e);
            e
        })?;

        // Wait for response with timeout
        let timeout_duration = std::time::Duration::from_secs(self.timeout_secs);

        let response = tokio::time::timeout(timeout_duration, client.recv_message())
            .await
            .map_err(|_| {
                warn!(
                    "Handler {} timed out after {}s",
                    self.handler_id, self.timeout_secs
                );
                ZapError::Timeout(format!(
                    "Handler {} did not respond within {}s",
                    self.handler_id, self.timeout_secs
                ))
            })?
            .map_err(|_| {
                error!("IPC connection closed without response");
                ZapError::Ipc("Connection closed unexpectedly".to_string())
            })?
            .ok_or_else(|| {
                error!("Received None from IPC channel");
                ZapError::Ipc("No response from handler".to_string())
            })?;

        debug!("📥 Received response from TypeScript handler");

        Ok(response)
    }
}

impl Handler for ProxyHandler {
    fn handle<'a>(
        &'a self,
        req: Request<'a>,
    ) -> Pin<Box<dyn Future<Output = Result<ZapResponse, ZapError>> + Send + 'a>> {
        Box::pin(async move {
            // Convert Rust request to IPC request format
            let body_bytes = req.body();
            let body_string = String::from_utf8_lossy(body_bytes).to_string();

            // Use the request data that's already been parsed
            let ipc_request = IpcRequest {
                method: req.method().to_string(),
                path: req.path().to_string(), // Already includes query string
                path_only: req.path_only().to_string(),
                query: req.query_params()
                    .iter()
                    .map(|(k, v)| (k.to_string(), v.to_string()))
                    .collect(),
                params: req.params()
                    .iter()
                    .map(|(k, v)| (k.to_string(), v.to_string()))
                    .collect(),
                headers: req.headers()
                    .iter()
                    .map(|(k, v)| (k.to_string(), v.to_string()))
                    .collect(),
                body: body_string,
                cookies: req.cookies()
                    .iter()
                    .map(|(k, v)| (k.to_string(), v.to_string()))
                    .collect(),
            };

            // Invoke TypeScript handler via IPC
            let response = self.invoke_handler(ipc_request).await?;

            // Convert IPC response back to HTTP response
            match response {
                IpcMessage::HandlerResponse {
                    handler_id: _,
                    status,
                    headers,
                    body,
                } => {
                    debug!("Converting IPC response to HTTP response (status: {})", status);

                    // Create status code
                    let status_code = zap_core::StatusCode::new(status);

                    // Build custom response with headers
                    let mut zap_response = zap_core::Response::with_status(status_code)
                        .body(body);

                    // Add headers from handler
                    for (key, value) in headers {
                        zap_response = zap_response.header(key, value);
                    }

                    Ok(ZapResponse::Custom(zap_response))
                }

                IpcMessage::Error { code, message } => {
                    error!(
                        "Handler {} returned error: {} - {}",
                        self.handler_id, code, message
                    );
                    Err(ZapError::Handler(format!(
                        "{}: {}",
                        code, message
                    )))
                }

                other => {
                    error!(
                        "Handler {} returned unexpected message type: {:?}",
                        self.handler_id, other
                    );
                    Err(ZapError::Handler(
                        "Invalid response type from TypeScript handler".to_string(),
                    ))
                }
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_proxy_handler_creation() {
        let handler = ProxyHandler::new(
            "handler_0".to_string(),
            "/tmp/zap.sock".to_string(),
        );
        assert_eq!(handler.handler_id, "handler_0");
        assert_eq!(handler.timeout_secs, 30);
    }

    #[test]
    fn test_proxy_handler_with_custom_timeout() {
        let handler = ProxyHandler::with_timeout(
            "handler_1".to_string(),
            "/tmp/zap.sock".to_string(),
            60,
        );
        assert_eq!(handler.handler_id, "handler_1");
        assert_eq!(handler.timeout_secs, 60);
    }
}
