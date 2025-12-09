//! Security headers and protection middleware
//!
//! Provides security-hardening features:
//! - Security headers (CSP, HSTS, X-Frame-Options, etc.)
//! - Rate limiting
//! - Request validation

use std::collections::HashMap;

/// Security configuration options
#[derive(Debug, Clone)]
pub struct SecurityConfig {
    /// Enable HSTS (HTTP Strict Transport Security)
    pub hsts_enabled: bool,
    /// HSTS max-age in seconds (default: 1 year)
    pub hsts_max_age: u64,
    /// Include subdomains in HSTS
    pub hsts_include_subdomains: bool,
    /// Enable X-Content-Type-Options: nosniff
    pub nosniff_enabled: bool,
    /// Enable X-Frame-Options
    pub frame_options: FrameOptions,
    /// Enable X-XSS-Protection
    pub xss_protection_enabled: bool,
    /// Content Security Policy
    pub content_security_policy: Option<String>,
    /// Referrer Policy
    pub referrer_policy: Option<String>,
    /// Permissions Policy
    pub permissions_policy: Option<String>,
    /// Cross-Origin-Opener-Policy
    pub coop: Option<String>,
    /// Cross-Origin-Embedder-Policy
    pub coep: Option<String>,
    /// Cross-Origin-Resource-Policy
    pub corp: Option<String>,
}

/// X-Frame-Options configuration
#[derive(Debug, Clone, Default)]
pub enum FrameOptions {
    /// No X-Frame-Options header
    #[default]
    None,
    /// DENY - prevent all framing
    Deny,
    /// SAMEORIGIN - allow same-origin framing
    SameOrigin,
    /// ALLOW-FROM (deprecated, but still used)
    AllowFrom(String),
}

impl Default for SecurityConfig {
    fn default() -> Self {
        Self {
            hsts_enabled: false,
            hsts_max_age: 31536000, // 1 year
            hsts_include_subdomains: true,
            nosniff_enabled: true,
            frame_options: FrameOptions::SameOrigin,
            xss_protection_enabled: true,
            content_security_policy: None,
            referrer_policy: Some("strict-origin-when-cross-origin".to_string()),
            permissions_policy: None,
            coop: None,
            coep: None,
            corp: None,
        }
    }
}

impl SecurityConfig {
    /// Create a new security config with sensible defaults
    pub fn new() -> Self {
        Self::default()
    }

    /// Create a strict security configuration
    pub fn strict() -> Self {
        Self {
            hsts_enabled: true,
            hsts_max_age: 31536000,
            hsts_include_subdomains: true,
            nosniff_enabled: true,
            frame_options: FrameOptions::Deny,
            xss_protection_enabled: true,
            content_security_policy: Some(
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'".to_string()
            ),
            referrer_policy: Some("strict-origin-when-cross-origin".to_string()),
            permissions_policy: Some("geolocation=(), microphone=(), camera=()".to_string()),
            coop: Some("same-origin".to_string()),
            coep: Some("require-corp".to_string()),
            corp: Some("same-origin".to_string()),
        }
    }

    /// Create an API-focused security configuration
    pub fn api() -> Self {
        Self {
            hsts_enabled: true,
            hsts_max_age: 31536000,
            hsts_include_subdomains: true,
            nosniff_enabled: true,
            frame_options: FrameOptions::Deny,
            xss_protection_enabled: false, // Not needed for JSON APIs
            content_security_policy: None, // Not typically used for APIs
            referrer_policy: Some("no-referrer".to_string()),
            permissions_policy: None,
            coop: None,
            coep: None,
            corp: Some("same-site".to_string()),
        }
    }

    /// Build security headers as a HashMap
    pub fn build_headers(&self) -> HashMap<String, String> {
        let mut headers = HashMap::new();

        // HSTS
        if self.hsts_enabled {
            let mut hsts = format!("max-age={}", self.hsts_max_age);
            if self.hsts_include_subdomains {
                hsts.push_str("; includeSubDomains");
            }
            headers.insert("Strict-Transport-Security".to_string(), hsts);
        }

        // X-Content-Type-Options
        if self.nosniff_enabled {
            headers.insert(
                "X-Content-Type-Options".to_string(),
                "nosniff".to_string(),
            );
        }

        // X-Frame-Options
        match &self.frame_options {
            FrameOptions::None => {}
            FrameOptions::Deny => {
                headers.insert("X-Frame-Options".to_string(), "DENY".to_string());
            }
            FrameOptions::SameOrigin => {
                headers.insert("X-Frame-Options".to_string(), "SAMEORIGIN".to_string());
            }
            FrameOptions::AllowFrom(uri) => {
                headers.insert(
                    "X-Frame-Options".to_string(),
                    format!("ALLOW-FROM {}", uri),
                );
            }
        }

        // X-XSS-Protection
        if self.xss_protection_enabled {
            headers.insert(
                "X-XSS-Protection".to_string(),
                "1; mode=block".to_string(),
            );
        }

        // Content-Security-Policy
        if let Some(ref csp) = self.content_security_policy {
            headers.insert("Content-Security-Policy".to_string(), csp.clone());
        }

        // Referrer-Policy
        if let Some(ref rp) = self.referrer_policy {
            headers.insert("Referrer-Policy".to_string(), rp.clone());
        }

        // Permissions-Policy
        if let Some(ref pp) = self.permissions_policy {
            headers.insert("Permissions-Policy".to_string(), pp.clone());
        }

        // Cross-Origin-Opener-Policy
        if let Some(ref coop) = self.coop {
            headers.insert("Cross-Origin-Opener-Policy".to_string(), coop.clone());
        }

        // Cross-Origin-Embedder-Policy
        if let Some(ref coep) = self.coep {
            headers.insert("Cross-Origin-Embedder-Policy".to_string(), coep.clone());
        }

        // Cross-Origin-Resource-Policy
        if let Some(ref corp) = self.corp {
            headers.insert("Cross-Origin-Resource-Policy".to_string(), corp.clone());
        }

        headers
    }
}

/// Rate limiting configuration
#[derive(Debug, Clone)]
pub struct RateLimitConfig {
    /// Maximum requests per window
    pub max_requests: u32,
    /// Window duration in seconds
    pub window_secs: u32,
    /// Key extractor function (default: IP-based)
    pub key_type: RateLimitKey,
}

/// How to identify rate-limited clients
#[derive(Debug, Clone, Default)]
pub enum RateLimitKey {
    /// By IP address
    #[default]
    IpAddress,
    /// By API key header
    ApiKey(String),
    /// By user ID (requires auth)
    UserId,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            max_requests: 100,
            window_secs: 60,
            key_type: RateLimitKey::IpAddress,
        }
    }
}

/// Simple in-memory rate limiter
pub struct RateLimiter {
    config: RateLimitConfig,
    // In production, use a proper data structure like a concurrent hashmap
    // For now, this is a placeholder
}

impl RateLimiter {
    /// Create a new rate limiter
    pub fn new(config: RateLimitConfig) -> Self {
        Self { config }
    }

    /// Check if a request should be allowed
    pub fn check(&self, _key: &str) -> RateLimitResult {
        // Placeholder implementation
        // In production, implement sliding window or token bucket
        RateLimitResult::Allowed {
            remaining: self.config.max_requests - 1,
            reset_after_secs: self.config.window_secs,
        }
    }
}

/// Result of rate limit check
#[derive(Debug)]
pub enum RateLimitResult {
    /// Request is allowed
    Allowed {
        /// Requests remaining in current window
        remaining: u32,
        /// Seconds until window resets
        reset_after_secs: u32,
    },
    /// Request is rate limited
    Limited {
        /// Seconds until limit resets
        retry_after_secs: u32,
    },
}

/// Request validation helpers
pub mod validation {
    #![allow(unused_imports)]
    use super::*;

    /// Maximum allowed request body size (10MB default)
    pub const DEFAULT_MAX_BODY_SIZE: usize = 10 * 1024 * 1024;

    /// Maximum allowed URL length
    pub const DEFAULT_MAX_URL_LENGTH: usize = 8192;

    /// Maximum allowed header count
    pub const DEFAULT_MAX_HEADERS: usize = 100;

    /// Maximum allowed header size
    pub const DEFAULT_MAX_HEADER_SIZE: usize = 8192;

    /// Validation result
    #[derive(Debug)]
    pub enum ValidationResult {
        Valid,
        Invalid(String),
    }

    /// Validate request size limits
    pub fn validate_request_size(
        body_size: usize,
        url_length: usize,
        header_count: usize,
        max_body: usize,
        max_url: usize,
        max_headers: usize,
    ) -> ValidationResult {
        if body_size > max_body {
            return ValidationResult::Invalid(format!(
                "Request body too large: {} > {}",
                body_size, max_body
            ));
        }

        if url_length > max_url {
            return ValidationResult::Invalid(format!(
                "URL too long: {} > {}",
                url_length, max_url
            ));
        }

        if header_count > max_headers {
            return ValidationResult::Invalid(format!(
                "Too many headers: {} > {}",
                header_count, max_headers
            ));
        }

        ValidationResult::Valid
    }

    /// Check for common attack patterns in paths
    pub fn validate_path(path: &str) -> ValidationResult {
        // Check for path traversal
        if path.contains("..") {
            return ValidationResult::Invalid("Path traversal detected".to_string());
        }

        // Check for null bytes
        if path.contains('\0') {
            return ValidationResult::Invalid("Null byte in path".to_string());
        }

        // Check for encoded traversal
        if path.contains("%2e%2e") || path.contains("%2E%2E") {
            return ValidationResult::Invalid("Encoded path traversal detected".to_string());
        }

        ValidationResult::Valid
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_security_config_default() {
        let config = SecurityConfig::default();
        let headers = config.build_headers();

        assert!(headers.contains_key("X-Content-Type-Options"));
        assert!(headers.contains_key("X-Frame-Options"));
        assert!(!headers.contains_key("Strict-Transport-Security")); // HSTS disabled by default
    }

    #[test]
    fn test_security_config_strict() {
        let config = SecurityConfig::strict();
        let headers = config.build_headers();

        assert!(headers.contains_key("Strict-Transport-Security"));
        assert!(headers.contains_key("Content-Security-Policy"));
        assert!(headers.contains_key("Cross-Origin-Opener-Policy"));
        assert_eq!(headers.get("X-Frame-Options"), Some(&"DENY".to_string()));
    }

    #[test]
    fn test_security_config_api() {
        let config = SecurityConfig::api();
        let headers = config.build_headers();

        assert!(headers.contains_key("Strict-Transport-Security"));
        assert!(!headers.contains_key("Content-Security-Policy")); // Not used for APIs
        assert!(!headers.contains_key("X-XSS-Protection")); // Not needed for JSON
    }

    #[test]
    fn test_path_validation() {
        use validation::*;

        assert!(matches!(validate_path("/api/users"), ValidationResult::Valid));
        assert!(matches!(
            validate_path("/../etc/passwd"),
            ValidationResult::Invalid(_)
        ));
        assert!(matches!(
            validate_path("/api%2e%2e/secret"),
            ValidationResult::Invalid(_)
        ));
    }

    #[test]
    fn test_request_size_validation() {
        use validation::*;

        let result = validate_request_size(
            1000,   // body
            100,    // url
            10,     // headers
            10000,  // max body
            1000,   // max url
            100,    // max headers
        );
        assert!(matches!(result, ValidationResult::Valid));

        let result = validate_request_size(
            100000, // body too large
            100,
            10,
            10000,
            1000,
            100,
        );
        assert!(matches!(result, ValidationResult::Invalid(_)));
    }
}
