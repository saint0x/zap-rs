//! Ultra-fast radix tree for route matching

use crate::params::Params;
use memchr::memchr;

/// High-performance radix tree for route matching
pub struct RadixTree<T> {
    root: Node<T>,
    size: usize,
}

/// Tree node optimized for routing
struct Node<T> {
    /// Path segment for this node
    segment: String,
    /// Handler if this is a terminal node
    handler: Option<T>,
    /// Static children (fastest lookup)
    children: Vec<Node<T>>,
    /// Parameter child (:param)
    param_child: Option<(String, Box<Node<T>>)>,
    /// Wildcard child (*param)
    wildcard_child: Option<(String, Box<Node<T>>)>,
    /// Catch-all child (**param)
    catchall_child: Option<(String, Box<Node<T>>)>,
}

impl<T> Node<T> {
    fn new(segment: String) -> Self {
        Self {
            segment,
            handler: None,
            children: Vec::new(),
            param_child: None,
            wildcard_child: None,
            catchall_child: None,
        }
    }
}

impl<T> RadixTree<T> {
    /// Create new radix tree
    pub fn new() -> Self {
        Self {
            root: Node::new(String::new()),
            size: 0,
        }
    }

    /// Insert route into tree
    pub fn insert(&mut self, path: &str, handler: T) -> Result<(), crate::RouterError> {
        if path.is_empty() || !path.starts_with('/') {
            return Err(crate::RouterError::InvalidPath(path.to_string()));
        }

        let segments = parse_path(path);
        self.insert_segments(&segments, handler)?;
        self.size += 1;
        Ok(())
    }

    /// Find handler for path with parameter extraction
    pub fn find<'a>(&'a self, path: &'a str) -> Option<(&'a T, Params<'a>)> {
        let mut params = Params::new();
        let clean_path = if path.starts_with('/') { &path[1..] } else { path };
        self.find_recursive_with_position(path, clean_path, &self.root, &mut params)
    }

    /// Get number of routes
    pub fn len(&self) -> usize {
        self.size
    }

    /// Check if tree is empty
    pub fn is_empty(&self) -> bool {
        self.size == 0
    }

    fn insert_segments(
        &mut self,
        segments: &[Segment],
        handler: T,
    ) -> Result<(), crate::RouterError> {
        Self::insert_segments_recursive(segments, handler, &mut self.root)
    }

    fn insert_segments_recursive(
        segments: &[Segment],
        handler: T,
        node: &mut Node<T>,
    ) -> Result<(), crate::RouterError> {
        if segments.is_empty() {
            if node.handler.is_some() {
                return Err(crate::RouterError::DuplicateRoute("Route exists".to_string()));
            }
            node.handler = Some(handler);
            return Ok(());
        }

        let segment = &segments[0];
        let remaining = &segments[1..];

        match segment {
            Segment::Static(s) => {
                // Find or create static child
                let child_pos = node.children.iter().position(|c| &c.segment == s);
                if let Some(pos) = child_pos {
                    Self::insert_segments_recursive(remaining, handler, &mut node.children[pos])
                } else {
                    let mut child = Node::new(s.clone());
                    Self::insert_segments_recursive(remaining, handler, &mut child)?;
                    node.children.push(child);
                    Ok(())
                }
            }
            Segment::Param(name) => {
                if node.param_child.is_none() {
                    node.param_child = Some((name.clone(), Box::new(Node::new(format!(":{}", name)))));
                }
                if let Some((_, ref mut child)) = node.param_child {
                    Self::insert_segments_recursive(remaining, handler, child)
                } else {
                    unreachable!()
                }
            }
            Segment::Wildcard(name) => {
                if node.wildcard_child.is_none() {
                    node.wildcard_child = Some((name.clone(), Box::new(Node::new(format!("*{}", name)))));
                }
                if let Some((_, ref mut child)) = node.wildcard_child {
                    Self::insert_segments_recursive(remaining, handler, child)
                } else {
                    unreachable!()
                }
            }
            Segment::CatchAll(name) => {
                if node.catchall_child.is_some() {
                    return Err(crate::RouterError::DuplicateRoute("Catch-all exists".to_string()));
                }
                let mut child = Node::new(format!("**{}", name));
                child.handler = Some(handler);
                node.catchall_child = Some((name.clone(), Box::new(child)));
                Ok(())
            }
        }
    }

    fn find_recursive_with_position<'a>(
        &self,
        original_path: &'a str,
        current_path: &'a str,
        node: &'a Node<T>,
        params: &mut Params<'a>,
    ) -> Option<(&'a T, Params<'a>)> {
        // Check if we've consumed the path
        if current_path.is_empty() {
            return node.handler.as_ref().map(|h| (h, params.clone()));
        }

        // Find next segment
        let (segment, remaining) = match memchr(b'/', current_path.as_bytes()) {
            Some(pos) => (&current_path[..pos], &current_path[pos + 1..]),
            None => (current_path, ""),
        };

        // Try static children first (fastest)
        for child in &node.children {
            if child.segment == segment {
                let result = self.find_recursive_with_position(original_path, remaining, child, params);
                if result.is_some() {
                    return result;
                }
            }
        }

        // Try parameter child
        if let Some((name, ref child)) = &node.param_child {
            let mut new_params = params.clone();
            new_params.insert(name, segment);
            let result = self.find_recursive_with_position(original_path, remaining, child, &mut new_params);
            if result.is_some() {
                return result;
            }
        }

        // Try wildcard child
        if let Some((name, ref child)) = &node.wildcard_child {
            let mut new_params = params.clone();
            // Calculate the wildcard value by finding the position in the original path
            let clean_path_len = if original_path.starts_with('/') { 
                original_path.len() - 1 
            } else { 
                original_path.len() 
            };
            let current_path_len = current_path.len();
            let consumed_in_clean = clean_path_len - current_path_len;
            
            let wildcard_start = if original_path.starts_with('/') {
                consumed_in_clean + 1 // Account for the leading slash
            } else {
                consumed_in_clean
            };
            
            let wildcard_value = &original_path[wildcard_start..];
            new_params.insert(name, wildcard_value);
            
            // Wildcards consume the rest of the path, so check for handler directly
            return child.handler.as_ref().map(|h| (h, new_params));
        }

        // Try catch-all child
        if let Some((name, ref child)) = &node.catchall_child {
            let mut new_params = params.clone();
            new_params.insert(name, current_path);
            return child.handler.as_ref().map(|h| (h, new_params));
        }

        None
    }
}

impl<T> Default for RadixTree<T> {
    fn default() -> Self {
        Self::new()
    }
}

/// Path segment types
#[derive(Debug, Clone, PartialEq)]
enum Segment {
    Static(String),
    Param(String),
    Wildcard(String),
    CatchAll(String),
}

/// Parse path into segments
fn parse_path(path: &str) -> Vec<Segment> {
    let path = if path.starts_with('/') { &path[1..] } else { path };
    
    if path.is_empty() {
        return vec![];
    }

    path.split('/')
        .filter(|s| !s.is_empty())
        .map(|segment| {
            if let Some(param) = segment.strip_prefix("**") {
                Segment::CatchAll(param.to_string())
            } else if let Some(param) = segment.strip_prefix('*') {
                Segment::Wildcard(param.to_string())
            } else if let Some(param) = segment.strip_prefix(':') {
                Segment::Param(param.to_string())
            } else {
                Segment::Static(segment.to_string())
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_static_routes() {
        let mut tree = RadixTree::new();
        tree.insert("/", "root").unwrap();
        tree.insert("/users", "users").unwrap();
        tree.insert("/users/profile", "profile").unwrap();

        assert_eq!(tree.find("/").unwrap().0, &"root");
        assert_eq!(tree.find("/users").unwrap().0, &"users");
        assert_eq!(tree.find("/users/profile").unwrap().0, &"profile");
        assert!(tree.find("/nonexistent").is_none());
    }

    #[test]
    fn test_parameter_routes() {
        let mut tree = RadixTree::new();
        tree.insert("/users/:id", "get_user").unwrap();
        tree.insert("/users/:id/posts/:post_id", "get_post").unwrap();

        let (handler, params) = tree.find("/users/123").unwrap();
        assert_eq!(handler, &"get_user");
        assert_eq!(params.get("id"), Some("123"));

        let (handler, params) = tree.find("/users/456/posts/789").unwrap();
        assert_eq!(handler, &"get_post");
        assert_eq!(params.get("id"), Some("456"));
        assert_eq!(params.get("post_id"), Some("789"));
    }

    #[test]
    fn test_catch_all_routes() {
        let mut tree = RadixTree::new();
        tree.insert("/api/**path", "catch_all").unwrap();

        let (handler, params) = tree.find("/api/v1/users/123").unwrap();
        assert_eq!(handler, &"catch_all");
        assert_eq!(params.get("path"), Some("v1/users/123"));
    }
} 