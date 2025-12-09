//! Connection pool for Unix domain socket connections
//!
//! This module provides a high-performance connection pool for reusing
//! Unix domain socket connections, eliminating the overhead of creating
//! new connections for each IPC request.

use crate::error::{ZapError, ZapResult};
use once_cell::sync::Lazy;
use std::sync::Arc;
use tokio::net::UnixStream;
use tokio::sync::Mutex;
use tracing::debug;

/// Maximum number of idle connections to keep in the pool
const MAX_IDLE_CONNECTIONS: usize = 20;

/// Connection wrapper that tracks socket path
struct PooledConnection {
    stream: UnixStream,
    socket_path: String,
}

/// Global connection pool
static CONNECTION_POOL: Lazy<Mutex<Vec<PooledConnection>>> = Lazy::new(|| {
    Mutex::new(Vec::with_capacity(MAX_IDLE_CONNECTIONS))
});

/// Get a connection from the pool or create a new one
pub async fn get_connection(socket_path: &str) -> ZapResult<UnixStream> {
    // Try to get a connection from the pool
    let mut pool = CONNECTION_POOL.lock().await;
    
    // Look for an existing connection to the same socket
    if let Some(index) = pool.iter().position(|conn| conn.socket_path == socket_path) {
        let pooled = pool.swap_remove(index);
        debug!("Reusing pooled connection to {}", socket_path);
        return Ok(pooled.stream);
    }
    
    // Drop the lock before creating a new connection
    drop(pool);
    
    // Create a new connection
    debug!("Creating new connection to {}", socket_path);
    UnixStream::connect(socket_path)
        .await
        .map_err(|e| ZapError::Ipc(format!("Failed to connect to {}: {}", socket_path, e)))
}

/// Return a connection to the pool for reuse
pub async fn return_connection(stream: UnixStream, socket_path: String) {
    let mut pool = CONNECTION_POOL.lock().await;
    
    // Only keep connections if we haven't reached the limit
    if pool.len() < MAX_IDLE_CONNECTIONS {
        debug!("Returning connection to pool (current size: {})", pool.len());
        pool.push(PooledConnection { stream, socket_path });
    } else {
        debug!("Connection pool full, closing connection");
        // Connection will be dropped and closed
    }
}

/// Clear all connections from the pool
pub async fn clear_pool() {
    let mut pool = CONNECTION_POOL.lock().await;
    let count = pool.len();
    pool.clear();
    if count > 0 {
        debug!("Cleared {} connections from pool", count);
    }
}

/// Connection guard that automatically returns the connection to the pool
pub struct PooledUnixStream {
    stream: Option<UnixStream>,
    socket_path: Arc<String>,
}

impl PooledUnixStream {
    /// Create a new pooled connection
    pub async fn connect(socket_path: Arc<String>) -> ZapResult<Self> {
        let stream = get_connection(&socket_path).await?;
        Ok(Self {
            stream: Some(stream),
            socket_path,
        })
    }
    
    /// Get a mutable reference to the underlying stream
    pub fn stream_mut(&mut self) -> &mut UnixStream {
        self.stream.as_mut().expect("Stream already taken")
    }
    
    /// Take ownership of the stream (prevents automatic return to pool)
    pub fn take_stream(&mut self) -> Option<UnixStream> {
        self.stream.take()
    }
}

impl Drop for PooledUnixStream {
    fn drop(&mut self) {
        if let Some(stream) = self.stream.take() {
            let socket_path = self.socket_path.to_string();
            // Return to pool in background
            tokio::spawn(async move {
                return_connection(stream, socket_path).await;
            });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_connection_pool() {
        // Clear pool before test
        clear_pool().await;
        
        // Create a test socket path (won't actually connect)
        let socket_path = "/tmp/test_pool.sock";
        
        // Test pool is initially empty
        {
            let pool = CONNECTION_POOL.lock().await;
            assert_eq!(pool.len(), 0);
        }
        
        // Note: Actual connection tests would require a real Unix socket
        // This test just verifies the pool mechanics
    }
}