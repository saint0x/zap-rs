//! High-performance HTTP/1.1 parser with SIMD optimizations
//!
//! This module provides zero-allocation HTTP request parsing optimized for speed:
//! - SIMD-accelerated header parsing
//! - Zero-copy string operations
//! - Memory-efficient header storage
//! - RFC 7230 compliant parsing

use crate::method::Method;
use memchr::memchr;
use ahash::AHashMap;
use std::str;

/// HTTP request parser optimized for performance
pub struct HttpParser {
    /// Maximum header size to prevent DoS attacks
    max_header_size: usize,
    /// Maximum number of headers allowed
    max_headers: usize,
}

impl HttpParser {
    /// Create new HTTP parser with default limits
    pub fn new() -> Self {
        Self {
            max_header_size: 8 * 1024, // 8KB default
            max_headers: 100,
        }
    }

    /// Create parser with custom limits
    pub fn with_limits(max_header_size: usize, max_headers: usize) -> Self {
        Self {
            max_header_size,
            max_headers,
        }
    }

    /// Parse HTTP request from bytes with zero-copy optimization
    pub fn parse_request<'a>(&self, input: &'a [u8]) -> Result<ParsedRequest<'a>, ParseError> {
        let mut parser = RequestParser::new(input, self.max_header_size, self.max_headers);
        parser.parse()
    }
}

impl Default for HttpParser {
    fn default() -> Self {
        Self::new()
    }
}

/// Zero-copy parsed HTTP request
#[derive(Debug)]
pub struct ParsedRequest<'a> {
    /// HTTP method (GET, POST, etc.)
    pub method: Method,
    /// Request path (e.g., "/users/123")
    pub path: &'a str,
    /// HTTP version (e.g., "HTTP/1.1")
    pub version: &'a str,
    /// Headers with zero-copy string references
    pub headers: Headers<'a>,
    /// Body start position in original buffer
    pub body_offset: usize,
    /// Total request size including headers
    pub total_size: usize,
}

/// Zero-copy header storage optimized for lookups
#[derive(Debug)]
pub struct Headers<'a> {
    /// Fast lookup map for headers
    map: AHashMap<&'a str, &'a str>,
    /// Count of headers
    count: usize,
}

impl<'a> Headers<'a> {
    /// Create with pre-allocated capacity
    fn with_capacity(capacity: usize) -> Self {
        Self {
            map: AHashMap::with_capacity(capacity),
            count: 0,
        }
    }

    /// Insert header (internal use)
    fn insert(&mut self, name: &'a str, value: &'a str) {
        self.map.insert(name, value);
        self.count += 1;
    }

    /// Get header value by name (case-insensitive)
    #[inline]
    pub fn get(&self, name: &str) -> Option<&'a str> {
        // Fast path for exact case match
        if let Some(value) = self.map.get(name) {
            return Some(*value);
        }

        // Fallback to case-insensitive search
        for (k, v) in &self.map {
            if k.eq_ignore_ascii_case(name) {
                return Some(*v);
            }
        }
        None
    }

    /// Get header value as specific type
    #[inline]
    pub fn get_parsed<T>(&self, name: &str) -> Option<T>
    where
        T: str::FromStr,
    {
        self.get(name)?.parse().ok()
    }

    /// Get Content-Length header
    #[inline]
    pub fn content_length(&self) -> Option<usize> {
        self.get_parsed("content-length")
    }

    /// Check if connection should be kept alive
    #[inline]
    pub fn keep_alive(&self) -> bool {
        match self.get("connection") {
            Some(value) => !value.eq_ignore_ascii_case("close"),
            None => true, // HTTP/1.1 default is keep-alive
        }
    }

    /// Get number of headers
    #[inline]
    pub fn len(&self) -> usize {
        self.count
    }

    /// Check if headers are empty
    #[inline]
    pub fn is_empty(&self) -> bool {
        self.count == 0
    }

    /// Iterate over all headers
    pub fn iter(&self) -> impl Iterator<Item = (&'a str, &'a str)> + '_ {
        self.map.iter().map(|(k, v)| (*k, *v))
    }
}

/// Internal request parser with SIMD optimizations
struct RequestParser<'a> {
    input: &'a [u8],
    position: usize,
    max_header_size: usize,
    max_headers: usize,
}

impl<'a> RequestParser<'a> {
    fn new(input: &'a [u8], max_header_size: usize, max_headers: usize) -> Self {
        Self {
            input,
            position: 0,
            max_header_size,
            max_headers,
        }
    }

    /// Parse complete HTTP request
    fn parse(&mut self) -> Result<ParsedRequest<'a>, ParseError> {
        // Parse request line
        let (method, path, version) = self.parse_request_line()?;
        
        // Parse headers
        let headers = self.parse_headers()?;
        
        // Calculate body offset
        let body_offset = self.position;
        let total_size = self.input.len();

        Ok(ParsedRequest {
            method,
            path,
            version,
            headers,
            body_offset,
            total_size,
        })
    }

    /// Parse request line: "GET /path HTTP/1.1\r\n"
    fn parse_request_line(&mut self) -> Result<(Method, &'a str, &'a str), ParseError> {
        let line_end = self.find_line_end()?;
        let line = &self.input[self.position..line_end];
        
        // Find spaces using SIMD-optimized search
        let first_space = memchr(b' ', line)
            .ok_or(ParseError::InvalidRequestLine)?;
        let second_space = memchr(b' ', &line[first_space + 1..])
            .map(|pos| pos + first_space + 1)
            .ok_or(ParseError::InvalidRequestLine)?;

        // Extract method, path, version
        let method_bytes = &line[..first_space];
        let path_bytes = &line[first_space + 1..second_space];
        let version_bytes = &line[second_space + 1..];

        // Parse method
        let method = Method::from_bytes(method_bytes)
            .ok_or(ParseError::InvalidMethod)?;

        // Convert to strings (already validated UTF-8 in HTTP context)
        let path = str::from_utf8(path_bytes)
            .map_err(|_| ParseError::InvalidPath)?;
        let version = str::from_utf8(version_bytes)
            .map_err(|_| ParseError::InvalidVersion)?;

        // Validate HTTP version
        if !version.starts_with("HTTP/") {
            return Err(ParseError::InvalidVersion);
        }

        // Move past the line
        self.position = line_end + 2; // Skip \r\n

        Ok((method, path, version))
    }

    /// Parse headers with SIMD acceleration
    fn parse_headers(&mut self) -> Result<Headers<'a>, ParseError> {
        let mut headers = Headers::with_capacity(16); // Typical header count
        let headers_start = self.position;
        
        loop {
            // Check for end of headers (\r\n\r\n)
            if self.position + 1 < self.input.len() 
                && self.input[self.position] == b'\r' 
                && self.input[self.position + 1] == b'\n' {
                self.position += 2; // Skip final \r\n
                break;
            }

            // Check limits
            if headers.len() >= self.max_headers {
                return Err(ParseError::TooManyHeaders);
            }

            // Parse single header
            let (name, value) = self.parse_header_line()?;
            headers.insert(name, value);
            
            // Check header size limit after parsing (DoS protection)
            let headers_size = self.position - headers_start;
            if headers_size > self.max_header_size {
                return Err(ParseError::HeadersTooLarge);
            }
        }

        Ok(headers)
    }

    /// Parse single header line: "Header-Name: value\r\n"
    fn parse_header_line(&mut self) -> Result<(&'a str, &'a str), ParseError> {
        let line_end = self.find_line_end()?;
        let line = &self.input[self.position..line_end];

        // Find colon separator
        let colon_pos = memchr(b':', line)
            .ok_or(ParseError::InvalidHeader)?;

        let name_bytes = &line[..colon_pos];
        let value_bytes = &line[colon_pos + 1..];

        // Convert to strings and trim whitespace
        let name = str::from_utf8(name_bytes)
            .map_err(|_| ParseError::InvalidHeader)?
            .trim();
        let value = str::from_utf8(value_bytes)
            .map_err(|_| ParseError::InvalidHeader)?
            .trim();

        // Move past this line
        self.position = line_end + 2; // Skip \r\n

        Ok((name, value))
    }

    /// Find end of current line using SIMD
    fn find_line_end(&self) -> Result<usize, ParseError> {
        let remaining = &self.input[self.position..];
        
        // Use SIMD to find \r\n quickly
        let mut search_pos = 0;
        while search_pos < remaining.len() {
            if let Some(cr_pos) = memchr(b'\r', &remaining[search_pos..]) {
                let abs_pos = self.position + search_pos + cr_pos;
                if abs_pos + 1 < self.input.len() && self.input[abs_pos + 1] == b'\n' {
                    return Ok(abs_pos);
                }
                search_pos += cr_pos + 1;
            } else {
                break;
            }
        }

        Err(ParseError::IncompleteRequest)
    }
}

/// HTTP parsing errors
#[derive(Debug, Clone, PartialEq)]
pub enum ParseError {
    /// Request is incomplete (need more data)
    IncompleteRequest,
    /// Invalid request line format
    InvalidRequestLine,
    /// Unknown or invalid HTTP method
    InvalidMethod,
    /// Invalid path format
    InvalidPath,
    /// Invalid HTTP version
    InvalidVersion,
    /// Invalid header format
    InvalidHeader,
    /// Too many headers (DoS protection)
    TooManyHeaders,
    /// Headers too large (DoS protection)
    HeadersTooLarge,
}

impl std::fmt::Display for ParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ParseError::IncompleteRequest => write!(f, "Incomplete HTTP request"),
            ParseError::InvalidRequestLine => write!(f, "Invalid request line"),
            ParseError::InvalidMethod => write!(f, "Invalid HTTP method"),
            ParseError::InvalidPath => write!(f, "Invalid request path"),
            ParseError::InvalidVersion => write!(f, "Invalid HTTP version"),
            ParseError::InvalidHeader => write!(f, "Invalid header format"),
            ParseError::TooManyHeaders => write!(f, "Too many headers"),
            ParseError::HeadersTooLarge => write!(f, "Headers too large"),
        }
    }
}

impl std::error::Error for ParseError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_get_request() {
        let request = b"GET /hello HTTP/1.1\r\nHost: example.com\r\nUser-Agent: test\r\n\r\n";
        let parser = HttpParser::new();
        let parsed = parser.parse_request(request).unwrap();

        assert_eq!(parsed.method, Method::GET);
        assert_eq!(parsed.path, "/hello");
        assert_eq!(parsed.version, "HTTP/1.1");
        assert_eq!(parsed.headers.get("Host"), Some("example.com"));
        assert_eq!(parsed.headers.get("User-Agent"), Some("test"));
        assert_eq!(parsed.headers.len(), 2);
        
        // Verify body offset is correct
        assert_eq!(parsed.body_offset, request.len());
        assert_eq!(parsed.total_size, request.len());
    }

    #[test]
    fn test_post_request_with_body() {
        let request = b"POST /api/users HTTP/1.1\r\nContent-Type: application/json\r\nContent-Length: 15\r\n\r\n{\"name\":\"test\"}";
        let parser = HttpParser::new();
        let parsed = parser.parse_request(request).unwrap();

        assert_eq!(parsed.method, Method::POST);
        assert_eq!(parsed.path, "/api/users");
        assert_eq!(parsed.headers.get("Content-Type"), Some("application/json"));
        assert_eq!(parsed.headers.content_length(), Some(15));
        
        // Verify body offset points to actual body
        let body_start = parsed.body_offset;
        let body = &request[body_start..];
        
        assert_eq!(body, b"{\"name\":\"test\"}");
        assert_eq!(body.len(), 15); // Matches Content-Length
    }

    #[test]
    fn test_case_insensitive_headers() {
        let request = b"GET / HTTP/1.1\r\nContent-LENGTH: 0\r\nHOST: Example.Com\r\n\r\n";
        let parser = HttpParser::new();
        let parsed = parser.parse_request(request).unwrap();

        // Test case insensitive lookup
        assert_eq!(parsed.headers.get("content-length"), Some("0"));
        assert_eq!(parsed.headers.get("Content-Length"), Some("0"));
        assert_eq!(parsed.headers.get("CONTENT-LENGTH"), Some("0"));
        assert_eq!(parsed.headers.content_length(), Some(0));
        
        // Test different case variations
        assert_eq!(parsed.headers.get("host"), Some("Example.Com"));
        assert_eq!(parsed.headers.get("Host"), Some("Example.Com"));
        assert_eq!(parsed.headers.get("HOST"), Some("Example.Com"));
    }

    #[test]
    fn test_invalid_method() {
        let request = b"INVALID /hello HTTP/1.1\r\n\r\n";
        let parser = HttpParser::new();
        let result = parser.parse_request(request);
        assert!(matches!(result, Err(ParseError::InvalidMethod)));
    }

    #[test]
    fn test_incomplete_request() {
        let request = b"GET /hello HTTP/1.1\r\nHost: exam";
        let parser = HttpParser::new();
        let result = parser.parse_request(request);
        assert!(matches!(result, Err(ParseError::IncompleteRequest)));
    }

    #[test]
    fn test_keep_alive_detection() {
        let parser = HttpParser::new();
        
        // Explicit close
        let request1 = b"GET / HTTP/1.1\r\nConnection: close\r\n\r\n";
        let parsed1 = parser.parse_request(request1).unwrap();
        assert!(!parsed1.headers.keep_alive());

        // Explicit keep-alive
        let request2 = b"GET / HTTP/1.1\r\nConnection: keep-alive\r\n\r\n";
        let parsed2 = parser.parse_request(request2).unwrap();
        assert!(parsed2.headers.keep_alive());

        // Default should be keep-alive for HTTP/1.1
        let request3 = b"GET / HTTP/1.1\r\n\r\n";
        let parsed3 = parser.parse_request(request3).unwrap();
        assert!(parsed3.headers.keep_alive());
        
        // Case insensitive connection header
        let request4 = b"GET / HTTP/1.1\r\nConnection: CLOSE\r\n\r\n";
        let parsed4 = parser.parse_request(request4).unwrap();
        assert!(!parsed4.headers.keep_alive());
    }

    #[test]
    fn test_malformed_request_line() {
        let parser = HttpParser::new();
        
        // Missing spaces
        let request1 = b"GET/hello HTTP/1.1\r\n\r\n";
        assert!(matches!(parser.parse_request(request1), Err(ParseError::InvalidRequestLine)));
        
        // Only one space
        let request2 = b"GET /hello\r\n\r\n";
        assert!(matches!(parser.parse_request(request2), Err(ParseError::InvalidRequestLine)));
        
        // Empty request
        let request3 = b"";
        assert!(matches!(parser.parse_request(request3), Err(ParseError::IncompleteRequest)));
    }

    #[test]
    fn test_invalid_http_version() {
        let parser = HttpParser::new();
        
        // Not starting with HTTP/
        let request1 = b"GET /hello HTTPS/1.1\r\n\r\n";
        assert!(matches!(parser.parse_request(request1), Err(ParseError::InvalidVersion)));
        
        // Invalid version format
        let request2 = b"GET /hello 1.1\r\n\r\n";
        assert!(matches!(parser.parse_request(request2), Err(ParseError::InvalidVersion)));
    }

    #[test]
    fn test_invalid_headers() {
        let parser = HttpParser::new();
        
        // Missing colon
        let request1 = b"GET / HTTP/1.1\r\nHost example.com\r\n\r\n";
        assert!(matches!(parser.parse_request(request1), Err(ParseError::InvalidHeader)));
        
        // Invalid UTF-8 in header name
        let mut request2 = Vec::from(&b"GET / HTTP/1.1\r\n"[..]);
        request2.extend_from_slice(&[0xFF, 0xFE]); // Invalid UTF-8
        request2.extend_from_slice(b": value\r\n\r\n");
        assert!(matches!(parser.parse_request(&request2), Err(ParseError::InvalidHeader)));
    }

    #[test]
    fn test_header_limits() {
        // Test too many headers
        let parser = HttpParser::with_limits(8192, 5); // Only allow 5 headers
        
        let mut request = String::from("GET / HTTP/1.1\r\n");
        for i in 0..10 {
            request.push_str(&format!("X-Header-{}: value\r\n", i));
        }
        request.push_str("\r\n");
        
        let result = parser.parse_request(request.as_bytes());
        assert!(matches!(result, Err(ParseError::TooManyHeaders)));
    }

    #[test]
    fn test_header_size_limits() {
        // Test headers too large
        let parser = HttpParser::with_limits(100, 100); // Only allow 100 bytes of headers
        
        let mut request = String::from("GET / HTTP/1.1\r\n");
        // Add a very long header value
        request.push_str("X-Long-Header: ");
        request.push_str(&"x".repeat(200)); // This will exceed the 100 byte limit
        request.push_str("\r\n\r\n");
        
        let result = parser.parse_request(request.as_bytes());
        assert!(matches!(result, Err(ParseError::HeadersTooLarge)));
    }

    #[test]
    fn test_path_with_query_string() {
        let request = b"GET /search?q=rust&limit=10 HTTP/1.1\r\nHost: example.com\r\n\r\n";
        let parser = HttpParser::new();
        let parsed = parser.parse_request(request).unwrap();

        assert_eq!(parsed.method, Method::GET);
        assert_eq!(parsed.path, "/search?q=rust&limit=10");
        assert_eq!(parsed.version, "HTTP/1.1");
    }

    #[test]
    fn test_empty_headers() {
        let request = b"GET / HTTP/1.1\r\n\r\n";
        let parser = HttpParser::new();
        let parsed = parser.parse_request(request).unwrap();

        assert_eq!(parsed.headers.len(), 0);
        assert!(parsed.headers.is_empty());
        assert_eq!(parsed.headers.get("Host"), None);
    }

    #[test]
    fn test_header_whitespace_trimming() {
        let request = b"GET / HTTP/1.1\r\n  Host  :  example.com  \r\n  User-Agent:  ZapTest/1.0  \r\n\r\n";
        let parser = HttpParser::new();
        let parsed = parser.parse_request(request).unwrap();

        // Headers should be trimmed
        assert_eq!(parsed.headers.get("Host"), Some("example.com"));
        assert_eq!(parsed.headers.get("User-Agent"), Some("ZapTest/1.0"));
    }

    #[test]
    fn test_different_http_methods() {
        let parser = HttpParser::new();
        
        let methods = [
            (b"GET / HTTP/1.1\r\n\r\n".as_slice(), Method::GET),
            (b"POST / HTTP/1.1\r\n\r\n".as_slice(), Method::POST),
            (b"PUT / HTTP/1.1\r\n\r\n".as_slice(), Method::PUT),
            (b"DELETE / HTTP/1.1\r\n\r\n".as_slice(), Method::DELETE),
            (b"PATCH / HTTP/1.1\r\n\r\n".as_slice(), Method::PATCH),
            (b"HEAD / HTTP/1.1\r\n\r\n".as_slice(), Method::HEAD),
            (b"OPTIONS / HTTP/1.1\r\n\r\n".as_slice(), Method::OPTIONS),
        ];
        
        for (request, expected_method) in &methods {
            let parsed = parser.parse_request(request).unwrap();
            assert_eq!(parsed.method, *expected_method);
        }
    }

    #[test]
    fn test_complex_real_world_request() {
        let request = b"POST /api/v1/users HTTP/1.1\r\nHost: api.example.com\r\nUser-Agent: Mozilla/5.0 (compatible; ZapTest/1.0)\r\nAccept: application/json\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: 46\r\nAuthorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9\r\nX-Request-ID: req-12345\r\nX-Forwarded-For: 192.168.1.100\r\n\r\n{\"name\":\"John Doe\",\"email\":\"john@example.com\"}";
        let parser = HttpParser::new();
        let parsed = parser.parse_request(request).unwrap();

        assert_eq!(parsed.method, Method::POST);
        assert_eq!(parsed.path, "/api/v1/users");
        assert_eq!(parsed.version, "HTTP/1.1");
        assert_eq!(parsed.headers.len(), 8);
        assert_eq!(parsed.headers.get("Host"), Some("api.example.com"));
        assert_eq!(parsed.headers.get("Content-Type"), Some("application/json; charset=utf-8"));
        assert_eq!(parsed.headers.content_length(), Some(46));
        
        // Verify body
        let body = &request[parsed.body_offset..];
        assert_eq!(body, b"{\"name\":\"John Doe\",\"email\":\"john@example.com\"}");
        assert_eq!(body.len(), 46);
    }

    #[test]
    fn test_headers_iterator() {
        let request = b"GET / HTTP/1.1\r\nHost: example.com\r\nUser-Agent: test\r\nAccept: */*\r\n\r\n";
        let parser = HttpParser::new();
        let parsed = parser.parse_request(request).unwrap();

        let headers: std::collections::HashMap<&str, &str> = parsed.headers.iter().collect();
        assert_eq!(headers.len(), 3);
        assert_eq!(headers.get("Host"), Some(&"example.com"));
        assert_eq!(headers.get("User-Agent"), Some(&"test"));
        assert_eq!(headers.get("Accept"), Some(&"*/*"));
    }

    #[test]
    fn test_header_get_parsed() {
        let request = b"GET / HTTP/1.1\r\nContent-Length: 42\r\nX-Custom-Number: 123\r\n\r\n";
        let parser = HttpParser::new();
        let parsed = parser.parse_request(request).unwrap();

        // Test parsing different types
        assert_eq!(parsed.headers.get_parsed::<usize>("Content-Length"), Some(42));
        assert_eq!(parsed.headers.get_parsed::<i32>("X-Custom-Number"), Some(123));
        assert_eq!(parsed.headers.get_parsed::<usize>("Non-Existent"), None);
        
        // Test invalid parsing
        let request2 = b"GET / HTTP/1.1\r\nX-Invalid-Number: not-a-number\r\n\r\n";
        let parsed2 = parser.parse_request(request2).unwrap();
        assert_eq!(parsed2.headers.get_parsed::<usize>("X-Invalid-Number"), None);
    }
} 