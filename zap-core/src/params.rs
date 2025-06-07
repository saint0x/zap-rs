//! Zero-copy route parameter extraction

use ahash::AHashMap;

/// Zero-copy route parameters container
///
/// Uses borrowed string slices to avoid allocations during parameter extraction.
/// Parameters are stored in a fast hash map for O(1) lookups.
#[derive(Debug, Clone)]
pub struct Params<'a> {
    inner: AHashMap<&'a str, &'a str>,
}

impl<'a> Params<'a> {
    /// Create new empty parameters container
    #[inline]
    pub fn new() -> Self {
        Self {
            inner: AHashMap::new(),
        }
    }

    /// Create with pre-allocated capacity for known parameter count
    #[inline]
    pub fn with_capacity(capacity: usize) -> Self {
        Self {
            inner: AHashMap::with_capacity(capacity),
        }
    }

    /// Insert a parameter (internal use only)
    #[inline]
    pub(crate) fn insert(&mut self, key: &'a str, value: &'a str) {
        self.inner.insert(key, value);
    }

    /// Get parameter value by name
    #[inline]
    pub fn get(&self, name: &str) -> Option<&'a str> {
        self.inner.get(name).copied()
    }

    /// Check if parameter exists
    #[inline]
    pub fn contains(&self, name: &str) -> bool {
        self.inner.contains_key(name)
    }

    /// Get parameter count
    #[inline]
    pub fn len(&self) -> usize {
        self.inner.len()
    }

    /// Check if parameters are empty
    #[inline]
    pub fn is_empty(&self) -> bool {
        self.inner.is_empty()
    }

    /// Iterate over all parameters
    #[inline]
    pub fn iter(&self) -> ParamsIter<'_, 'a> {
        ParamsIter {
            inner: self.inner.iter(),
        }
    }

    /// Parse parameter as specific type
    #[inline]
    pub fn parse<T>(&self, name: &str) -> Result<T, ParamError>
    where
        T: std::str::FromStr,
        T::Err: std::fmt::Display,
    {
        let value = self.get(name).ok_or_else(|| ParamError::Missing(name.to_string()))?;
        value.parse::<T>().map_err(|e| ParamError::ParseError {
            name: name.to_string(),
            value: value.to_string(),
            error: e.to_string(),
        })
    }

    /// Get parameter as u64 (common case optimization)
    #[inline]
    pub fn get_u64(&self, name: &str) -> Option<u64> {
        self.get(name)?.parse().ok()
    }

    /// Get parameter as i64 (common case optimization)
    #[inline]
    pub fn get_i64(&self, name: &str) -> Option<i64> {
        self.get(name)?.parse().ok()
    }

    /// Get parameter as UUID string (common case optimization)  
    #[inline]
    pub fn get_uuid(&self, name: &str) -> Option<&'a str> {
        let value = self.get(name)?;
        // Basic UUID format validation (36 chars with hyphens)
        if value.len() == 36 && value.chars().nth(8) == Some('-') {
            Some(value)
        } else {
            None
        }
    }
}

impl<'a> Default for Params<'a> {
    fn default() -> Self {
        Self::new()
    }
}

/// Iterator over route parameters
pub struct ParamsIter<'b, 'a> {
    inner: std::collections::hash_map::Iter<'b, &'a str, &'a str>,
}

impl<'b, 'a> Iterator for ParamsIter<'b, 'a> {
    type Item = (&'a str, &'a str);

    #[inline]
    fn next(&mut self) -> Option<Self::Item> {
        self.inner.next().map(|(k, v)| (*k, *v))
    }

    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        self.inner.size_hint()
    }
}

impl<'b, 'a> ExactSizeIterator for ParamsIter<'b, 'a> {}

/// Parameter parsing errors
#[derive(Debug, Clone, PartialEq)]
pub enum ParamError {
    /// Parameter not found
    Missing(String),
    /// Parameter parsing failed
    ParseError {
        name: String,
        value: String, 
        error: String,
    },
}

impl std::fmt::Display for ParamError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ParamError::Missing(name) => write!(f, "Parameter '{}' not found", name),
            ParamError::ParseError { name, value, error } => {
                write!(f, "Failed to parse parameter '{}' with value '{}': {}", name, value, error)
            }
        }
    }
}

impl std::error::Error for ParamError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_params_basic_operations() {
        let mut params = Params::new();
        params.insert("id", "123");
        params.insert("name", "test");

        assert_eq!(params.get("id"), Some("123"));
        assert_eq!(params.get("name"), Some("test"));
        assert_eq!(params.get("missing"), None);
        assert_eq!(params.len(), 2);
        assert!(!params.is_empty());
    }

    #[test]
    fn test_params_parsing() {
        let mut params = Params::new();
        params.insert("id", "123");
        params.insert("invalid", "not_a_number");

        assert_eq!(params.parse::<u64>("id").unwrap(), 123);
        assert_eq!(params.get_u64("id"), Some(123));
        assert!(params.parse::<u64>("invalid").is_err());
        assert!(params.parse::<u64>("missing").is_err());
    }

    #[test]
    fn test_params_iteration() {
        let mut params = Params::new();
        params.insert("a", "1");
        params.insert("b", "2");

        let collected: AHashMap<&str, &str> = params.iter().collect();
        assert_eq!(collected.len(), 2);
        assert_eq!(collected.get("a"), Some(&"1"));
        assert_eq!(collected.get("b"), Some(&"2"));
    }

    #[test]
    fn test_uuid_validation() {
        let mut params = Params::new();
        params.insert("valid_uuid", "550e8400-e29b-41d4-a716-446655440000");
        params.insert("invalid_uuid", "not-a-uuid");

        assert!(params.get_uuid("valid_uuid").is_some());
        assert!(params.get_uuid("invalid_uuid").is_none());
    }
} 