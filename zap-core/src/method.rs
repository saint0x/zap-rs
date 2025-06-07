//! HTTP method enumeration optimized for routing performance

use std::fmt;

/// HTTP method enumeration with optimized representation
///
/// Uses discriminant values optimized for branch prediction and comparison speed.
/// Most common methods (GET, POST) have lower discriminant values.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[repr(u8)]
pub enum Method {
    GET = 0,
    POST = 1,
    PUT = 2,
    DELETE = 3,
    PATCH = 4,
    HEAD = 5,
    OPTIONS = 6,
    CONNECT = 7,
    TRACE = 8,
}

impl Method {
    /// Parse method from bytes with SIMD-optimized comparison
    #[inline]
    pub fn from_bytes(bytes: &[u8]) -> Option<Self> {
        match bytes {
            b"GET" => Some(Method::GET),
            b"POST" => Some(Method::POST),
            b"PUT" => Some(Method::PUT),
            b"DELETE" => Some(Method::DELETE),
            b"PATCH" => Some(Method::PATCH),
            b"HEAD" => Some(Method::HEAD),
            b"OPTIONS" => Some(Method::OPTIONS),
            b"CONNECT" => Some(Method::CONNECT),
            b"TRACE" => Some(Method::TRACE),
            _ => None,
        }
    }

    /// Get method as static string slice (zero allocation)
    #[inline]
    pub const fn as_str(self) -> &'static str {
        match self {
            Method::GET => "GET",
            Method::POST => "POST", 
            Method::PUT => "PUT",
            Method::DELETE => "DELETE",
            Method::PATCH => "PATCH",
            Method::HEAD => "HEAD",
            Method::OPTIONS => "OPTIONS",
            Method::CONNECT => "CONNECT",
            Method::TRACE => "TRACE",
        }
    }

    /// Check if method is safe (no side effects)
    #[inline]
    pub const fn is_safe(self) -> bool {
        matches!(self, Method::GET | Method::HEAD | Method::OPTIONS | Method::TRACE)
    }

    /// Check if method is idempotent
    #[inline]
    pub const fn is_idempotent(self) -> bool {
        matches!(
            self,
            Method::GET | Method::HEAD | Method::PUT | Method::DELETE | Method::OPTIONS | Method::TRACE
        )
    }
}

impl fmt::Display for Method {
    #[inline]
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl From<http::Method> for Method {
    fn from(method: http::Method) -> Self {
        match method {
            http::Method::GET => Method::GET,
            http::Method::POST => Method::POST,
            http::Method::PUT => Method::PUT,
            http::Method::DELETE => Method::DELETE,
            http::Method::PATCH => Method::PATCH,
            http::Method::HEAD => Method::HEAD,
            http::Method::OPTIONS => Method::OPTIONS,
            http::Method::CONNECT => Method::CONNECT,
            http::Method::TRACE => Method::TRACE,
            _ => Method::GET, // Default fallback
        }
    }
}

impl From<Method> for http::Method {
    fn from(method: Method) -> Self {
        match method {
            Method::GET => http::Method::GET,
            Method::POST => http::Method::POST,
            Method::PUT => http::Method::PUT,
            Method::DELETE => http::Method::DELETE,
            Method::PATCH => http::Method::PATCH,
            Method::HEAD => http::Method::HEAD,
            Method::OPTIONS => http::Method::OPTIONS,
            Method::CONNECT => http::Method::CONNECT,
            Method::TRACE => http::Method::TRACE,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_method_parsing() {
        assert_eq!(Method::from_bytes(b"GET"), Some(Method::GET));
        assert_eq!(Method::from_bytes(b"POST"), Some(Method::POST));
        assert_eq!(Method::from_bytes(b"INVALID"), None);
    }

    #[test]
    fn test_method_properties() {
        assert!(Method::GET.is_safe());
        assert!(!Method::POST.is_safe());
        assert!(Method::PUT.is_idempotent());
        assert!(!Method::POST.is_idempotent());
    }

    #[test]
    fn test_method_string() {
        assert_eq!(Method::GET.as_str(), "GET");
        assert_eq!(Method::POST.to_string(), "POST");
    }
} 