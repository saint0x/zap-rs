use std::collections::HashMap;

pub struct TrieNode<T> {
    value: Option<T>,
    children: HashMap<String, TrieNode<T>>,
    param_child: Option<Box<TrieNode<T>>>,
    wildcard: Option<Box<TrieNode<T>>>,
    is_param: bool,
}

impl<T: Clone> TrieNode<T> {
    pub fn new() -> Self {
        Self {
            value: None,
            children: HashMap::new(),
            param_child: None,
            wildcard: None,
            is_param: false,
        }
    }

    pub fn insert(&mut self, path: &str, value: T) {
        let segments: Vec<&str> = path.split('/')
            .filter(|s| !s.is_empty())
            .collect();
        
        self.insert_segments(&segments, value);
    }

    fn insert_segments(&mut self, segments: &[&str], value: T) {
        if segments.is_empty() {
            self.value = Some(value);
            return;
        }

        let segment = segments[0];
        let remaining = &segments[1..];

        if segment.starts_with(':') {
            // Parameter segment
            if self.param_child.is_none() {
                self.param_child = Some(Box::new(TrieNode {
                    value: None,
                    children: HashMap::new(),
                    param_child: None,
                    wildcard: None,
                    is_param: true,
                }));
            }
            self.param_child.as_mut().unwrap().insert_segments(remaining, value);
        } else if segment == "*" {
            // Wildcard segment
            if self.wildcard.is_none() {
                self.wildcard = Some(Box::new(TrieNode {
                    value: Some(value),
                    children: HashMap::new(),
                    param_child: None,
                    wildcard: None,
                    is_param: false,
                }));
            }
        } else {
            // Static segment
            let node = self.children
                .entry(segment.to_string())
                .or_insert_with(TrieNode::new);
            node.insert_segments(remaining, value);
        }
    }

    pub fn lookup<'a>(&'a self, path: &str, params: &mut HashMap<String, String>) -> Option<&'a T> {
        let segments: Vec<&str> = path.split('/')
            .filter(|s| !s.is_empty())
            .collect();
        
        self.lookup_segments(&segments, params)
    }

    fn lookup_segments<'a>(&'a self, segments: &[&str], params: &mut HashMap<String, String>) -> Option<&'a T> {
        if segments.is_empty() {
            return self.value.as_ref();
        }

        let segment = segments[0];
        let remaining = &segments[1..];

        // Try static route first
        if let Some(child) = self.children.get(segment) {
            if let Some(value) = child.lookup_segments(remaining, params) {
                return Some(value);
            }
        }

        // Try parameter route
        if let Some(param_child) = &self.param_child {
            if self.is_param {
                // Extract parameter name from the node's path (without ':' prefix)
                let param_name = segment.to_string();
                params.insert(param_name, segment.to_string());
            }
            if let Some(value) = param_child.lookup_segments(remaining, params) {
                return Some(value);
            }
        }

        // Try wildcard route
        self.wildcard.as_ref().and_then(|w| w.value.as_ref())
    }
}

impl<T> Default for TrieNode<T> {
    fn default() -> Self {
        Self::new()
    }
} 