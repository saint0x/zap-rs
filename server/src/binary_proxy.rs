//! Binary Proxy handler that forwards requests to TypeScript via binary IPC
//!
//! This is a high-performance alternative to the JSON-based proxy handler.
//! Uses rkyv binary serialization for 50-100x faster IPC communication.

use crate::binary_ipc::{BinaryHandlerResponse, BinaryInvokeHandler, BinaryIpcClient, BinaryIpcRequest};
use crate::connection_pool;
use crate::error::{ZapError, ZapResult};
use crate::handler::Handler;
use crate::response::ZapResponse;
use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use tracing::{debug, error, warn};
use zap_core::Request;

/// Handler that proxies requests to TypeScript via binary IPC
pub struct BinaryProxyHandler {
    /// Unique identifier for this handler
    handler_id: String,

    /// Path to the Unix socket for IPC communication
    ipc_socket_path: Arc<String>,

    /// Request timeout in seconds
    timeout_secs: u64,
}

impl BinaryProxyHandler {
    /// Create a new binary proxy handler
    pub fn new(handler_id: String, ipc_socket_path: String) -> Self {
        Self {
            handler_id,
            ipc_socket_path: Arc::new(ipc_socket_path),
            timeout_secs: 30,
        }
    }

    /// Create with custom timeout
    pub fn with_timeout(handler_id: String, ipc_socket_path: String, timeout_secs: u64) -> Self {
        Self {
            handler_id,
            ipc_socket_path: Arc::new(ipc_socket_path),
            timeout_secs,
        }
    }

    /// Make a binary IPC request to the TypeScript handler
    async fn invoke_handler(&self, request: BinaryIpcRequest) -> ZapResult<BinaryHandlerResponse> {
        debug!(
            "📤 [Binary] Invoking TypeScript handler: {} for {} {}",
            self.handler_id, request.method, request.path
        );

        // Get a pooled connection to TypeScript's IPC server
        let stream = connection_pool::get_connection(self.ipc_socket_path.as_str())
            .await
            .map_err(|e| {
                error!("Failed to get pooled connection: {}", e);
                e
            })?;

        // Create binary IPC client with the pooled connection
        let mut client = BinaryIpcClient::from_pooled_stream(stream, Arc::clone(&self.ipc_socket_path));

        // Create invocation message
        let invoke = BinaryInvokeHandler {
            handler_id: self.handler_id.clone(),
            request,
        };

        // Send the invocation
        client.send_invoke(&invoke).await.map_err(|e| {
            error!("Failed to send binary IPC message: {}", e);
            e
        })?;

        // Wait for response with timeout
        let timeout_duration = std::time::Duration::from_secs(self.timeout_secs);

        let response = tokio::time::timeout(timeout_duration, client.recv_response())
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
            .map_err(|e| {
                error!("Binary IPC error: {}", e);
                e
            })?
            .ok_or_else(|| {
                error!("Received None from binary IPC channel");
                ZapError::Ipc("No response from handler".to_string())
            })?;

        debug!("📥 [Binary] Received response from TypeScript handler");

        Ok(response)
    }
}

impl Handler for BinaryProxyHandler {
    fn handle<'a>(
        &'a self,
        req: Request<'a>,
    ) -> Pin<Box<dyn Future<Output = Result<ZapResponse, ZapError>> + Send + 'a>> {
        Box::pin(async move {
            // Convert request data to maps for binary serialization
            let query: HashMap<String, String> = req
                .query_params()
                .iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect();
            let params: HashMap<String, String> = req
                .params()
                .iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect();
            let headers: HashMap<String, String> = req
                .headers()
                .iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect();
            let cookies: HashMap<String, String> = req
                .cookies()
                .iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect();

            // Create binary IPC request
            let binary_request = BinaryIpcRequest::from_maps(
                req.method().to_string(),
                req.path().to_string(),
                req.path_only().to_string(),
                &query,
                &params,
                &headers,
                req.body().to_vec(),
                &cookies,
            );

            // Invoke TypeScript handler via binary IPC
            let response = self.invoke_handler(binary_request).await?;

            // Convert binary response back to HTTP response
            debug!(
                "Converting binary IPC response to HTTP response (status: {})",
                response.status
            );

            // Create status code
            let status_code = zap_core::StatusCode::new(response.status);

            // Build custom response with headers
            let body = String::from_utf8_lossy(&response.body).to_string();
            let mut zap_response = zap_core::Response::with_status(status_code).body(body);

            // Add headers from handler
            let headers_map = response.to_headers_map();
            for (key, value) in headers_map {
                zap_response = zap_response.header(key, value);
            }

            Ok(ZapResponse::Custom(zap_response))
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_binary_proxy_handler_creation() {
        let handler = BinaryProxyHandler::new("handler_0".to_string(), "/tmp/zap.sock".to_string());
        assert_eq!(handler.handler_id, "handler_0");
        assert_eq!(handler.timeout_secs, 30);
    }

    #[test]
    fn test_binary_proxy_handler_with_custom_timeout() {
        let handler =
            BinaryProxyHandler::with_timeout("handler_1".to_string(), "/tmp/zap.sock".to_string(), 60);
        assert_eq!(handler.handler_id, "handler_1");
        assert_eq!(handler.timeout_secs, 60);
    }
}
