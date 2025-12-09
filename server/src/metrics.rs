//! Production metrics collection and reporting
//!
//! Provides Prometheus-compatible metrics for monitoring:
//! - Request counts and latencies
//! - Active connections
//! - Memory usage
//! - IPC statistics

use once_cell::sync::Lazy;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

/// Global metrics instance
pub static METRICS: Lazy<Metrics> = Lazy::new(Metrics::new);

/// Server metrics collection
pub struct Metrics {
    /// Total number of requests processed
    pub total_requests: AtomicU64,
    /// Number of successful requests (2xx)
    pub successful_requests: AtomicU64,
    /// Number of client errors (4xx)
    pub client_errors: AtomicU64,
    /// Number of server errors (5xx)
    pub server_errors: AtomicU64,
    /// Total request processing time in microseconds
    pub total_latency_us: AtomicU64,
    /// Number of active connections
    pub active_connections: AtomicU64,
    /// Number of IPC calls to TypeScript
    pub ipc_calls: AtomicU64,
    /// Number of IPC errors
    pub ipc_errors: AtomicU64,
    /// Total IPC latency in microseconds
    pub ipc_latency_us: AtomicU64,
    /// Server start time
    start_time: Instant,
}

impl Metrics {
    /// Create a new metrics instance
    pub fn new() -> Self {
        Self {
            total_requests: AtomicU64::new(0),
            successful_requests: AtomicU64::new(0),
            client_errors: AtomicU64::new(0),
            server_errors: AtomicU64::new(0),
            total_latency_us: AtomicU64::new(0),
            active_connections: AtomicU64::new(0),
            ipc_calls: AtomicU64::new(0),
            ipc_errors: AtomicU64::new(0),
            ipc_latency_us: AtomicU64::new(0),
            start_time: Instant::now(),
        }
    }

    /// Record a request
    #[inline]
    pub fn record_request(&self, status: u16, latency_us: u64) {
        self.total_requests.fetch_add(1, Ordering::Relaxed);
        self.total_latency_us.fetch_add(latency_us, Ordering::Relaxed);

        match status {
            200..=299 => {
                self.successful_requests.fetch_add(1, Ordering::Relaxed);
            }
            400..=499 => {
                self.client_errors.fetch_add(1, Ordering::Relaxed);
            }
            500..=599 => {
                self.server_errors.fetch_add(1, Ordering::Relaxed);
            }
            _ => {}
        }
    }

    /// Record an IPC call
    #[inline]
    pub fn record_ipc_call(&self, latency_us: u64, is_error: bool) {
        self.ipc_calls.fetch_add(1, Ordering::Relaxed);
        self.ipc_latency_us.fetch_add(latency_us, Ordering::Relaxed);
        if is_error {
            self.ipc_errors.fetch_add(1, Ordering::Relaxed);
        }
    }

    /// Increment active connections
    #[inline]
    pub fn connection_opened(&self) {
        self.active_connections.fetch_add(1, Ordering::Relaxed);
    }

    /// Decrement active connections
    #[inline]
    pub fn connection_closed(&self) {
        self.active_connections.fetch_sub(1, Ordering::Relaxed);
    }

    /// Get server uptime in seconds
    pub fn uptime_secs(&self) -> u64 {
        self.start_time.elapsed().as_secs()
    }

    /// Get average request latency in microseconds
    pub fn avg_latency_us(&self) -> u64 {
        let total = self.total_requests.load(Ordering::Relaxed);
        if total == 0 {
            return 0;
        }
        self.total_latency_us.load(Ordering::Relaxed) / total
    }

    /// Get average IPC latency in microseconds
    pub fn avg_ipc_latency_us(&self) -> u64 {
        let total = self.ipc_calls.load(Ordering::Relaxed);
        if total == 0 {
            return 0;
        }
        self.ipc_latency_us.load(Ordering::Relaxed) / total
    }

    /// Generate Prometheus-format metrics
    pub fn to_prometheus(&self) -> String {
        let total = self.total_requests.load(Ordering::Relaxed);
        let successful = self.successful_requests.load(Ordering::Relaxed);
        let client_err = self.client_errors.load(Ordering::Relaxed);
        let server_err = self.server_errors.load(Ordering::Relaxed);
        let active = self.active_connections.load(Ordering::Relaxed);
        let ipc_total = self.ipc_calls.load(Ordering::Relaxed);
        let ipc_errors = self.ipc_errors.load(Ordering::Relaxed);
        let avg_latency = self.avg_latency_us();
        let avg_ipc_latency = self.avg_ipc_latency_us();
        let uptime = self.uptime_secs();

        format!(
            r#"# HELP zap_requests_total Total number of HTTP requests
# TYPE zap_requests_total counter
zap_requests_total{{status="success"}} {}
zap_requests_total{{status="client_error"}} {}
zap_requests_total{{status="server_error"}} {}

# HELP zap_requests_total_count Total requests processed
# TYPE zap_requests_total_count counter
zap_requests_total_count {}

# HELP zap_active_connections Number of active connections
# TYPE zap_active_connections gauge
zap_active_connections {}

# HELP zap_request_latency_us Average request latency in microseconds
# TYPE zap_request_latency_us gauge
zap_request_latency_us {}

# HELP zap_ipc_calls_total Total IPC calls to TypeScript handlers
# TYPE zap_ipc_calls_total counter
zap_ipc_calls_total {}

# HELP zap_ipc_errors_total Total IPC errors
# TYPE zap_ipc_errors_total counter
zap_ipc_errors_total {}

# HELP zap_ipc_latency_us Average IPC latency in microseconds
# TYPE zap_ipc_latency_us gauge
zap_ipc_latency_us {}

# HELP zap_uptime_seconds Server uptime in seconds
# TYPE zap_uptime_seconds counter
zap_uptime_seconds {}
"#,
            successful,
            client_err,
            server_err,
            total,
            active,
            avg_latency,
            ipc_total,
            ipc_errors,
            avg_ipc_latency,
            uptime
        )
    }

    /// Generate JSON metrics
    pub fn to_json(&self) -> serde_json::Value {
        serde_json::json!({
            "requests": {
                "total": self.total_requests.load(Ordering::Relaxed),
                "successful": self.successful_requests.load(Ordering::Relaxed),
                "client_errors": self.client_errors.load(Ordering::Relaxed),
                "server_errors": self.server_errors.load(Ordering::Relaxed),
                "avg_latency_us": self.avg_latency_us()
            },
            "connections": {
                "active": self.active_connections.load(Ordering::Relaxed)
            },
            "ipc": {
                "total_calls": self.ipc_calls.load(Ordering::Relaxed),
                "errors": self.ipc_errors.load(Ordering::Relaxed),
                "avg_latency_us": self.avg_ipc_latency_us()
            },
            "server": {
                "uptime_seconds": self.uptime_secs(),
                "status": "healthy"
            }
        })
    }
}

impl Default for Metrics {
    fn default() -> Self {
        Self::new()
    }
}

/// Request timing helper
pub struct RequestTimer {
    start: Instant,
}

impl RequestTimer {
    /// Start a new request timer
    #[inline]
    pub fn start() -> Self {
        Self {
            start: Instant::now(),
        }
    }

    /// Get elapsed time in microseconds
    #[inline]
    pub fn elapsed_us(&self) -> u64 {
        self.start.elapsed().as_micros() as u64
    }

    /// Finish timing and record to metrics
    #[inline]
    pub fn finish(self, status: u16) {
        METRICS.record_request(status, self.elapsed_us());
    }
}

/// IPC timing helper
pub struct IpcTimer {
    start: Instant,
}

impl IpcTimer {
    /// Start a new IPC timer
    #[inline]
    pub fn start() -> Self {
        Self {
            start: Instant::now(),
        }
    }

    /// Finish timing and record to metrics
    #[inline]
    pub fn finish(self, is_error: bool) {
        let latency = self.start.elapsed().as_micros() as u64;
        METRICS.record_ipc_call(latency, is_error);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metrics_recording() {
        let metrics = Metrics::new();

        // Record some requests
        metrics.record_request(200, 1000);
        metrics.record_request(200, 2000);
        metrics.record_request(404, 500);
        metrics.record_request(500, 5000);

        assert_eq!(metrics.total_requests.load(Ordering::Relaxed), 4);
        assert_eq!(metrics.successful_requests.load(Ordering::Relaxed), 2);
        assert_eq!(metrics.client_errors.load(Ordering::Relaxed), 1);
        assert_eq!(metrics.server_errors.load(Ordering::Relaxed), 1);
        assert_eq!(metrics.avg_latency_us(), 2125); // (1000+2000+500+5000)/4
    }

    #[test]
    fn test_ipc_metrics() {
        let metrics = Metrics::new();

        metrics.record_ipc_call(100, false);
        metrics.record_ipc_call(200, false);
        metrics.record_ipc_call(300, true);

        assert_eq!(metrics.ipc_calls.load(Ordering::Relaxed), 3);
        assert_eq!(metrics.ipc_errors.load(Ordering::Relaxed), 1);
        assert_eq!(metrics.avg_ipc_latency_us(), 200);
    }

    #[test]
    fn test_prometheus_format() {
        let metrics = Metrics::new();
        metrics.record_request(200, 1000);

        let prometheus = metrics.to_prometheus();
        assert!(prometheus.contains("zap_requests_total"));
        assert!(prometheus.contains("zap_active_connections"));
    }

    #[test]
    fn test_json_format() {
        let metrics = Metrics::new();
        metrics.record_request(200, 1000);

        let json = metrics.to_json();
        assert!(json["requests"]["total"].as_u64().unwrap() > 0);
    }
}
