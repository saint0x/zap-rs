use std::collections::HashMap;

#[derive(Clone)]
pub struct TrieNode<T: Clone> {
    children: HashMap<String, TrieNode<T>>,
    value: Option<T>,
    is_wildcard: bool,
}

impl<T: Clone> TrieNode<T> {
    pub fn new() -> Self {
        Self {
            children: HashMap::new(),
            value: None,
            is_wildcard: false,
        }
    }

    pub fn insert(&mut self, path: &str, value: T) {
        let mut current = self;
        for segment in path.split('/').filter(|s| !s.is_empty()) {
            let is_wildcard = segment.starts_with(':');
            let key = if is_wildcard {
                segment[1..].to_string()
            } else {
                segment.to_string()
            };

            current = current.children.entry(key).or_insert_with(|| TrieNode {
                children: HashMap::new(),
                value: None,
                is_wildcard: is_wildcard,
            });
        }
        current.value = Some(value);
    }

    pub fn lookup<'a>(&'a self, path: &str, params: &mut HashMap<String, String>) -> Option<&'a T> {
        let mut current = self;
        for segment in path.split('/').filter(|s| !s.is_empty()) {
            // First try exact match
            if let Some(child) = current.children.get(segment) {
                current = child;
                continue;
            }

            // Then try wildcard match
            let mut found = false;
            for (key, child) in &current.children {
                if child.is_wildcard {
                    params.insert(key.clone(), segment.to_string());
                    current = child;
                    found = true;
                    break;
                }
            }

            if !found {
                return None;
            }
        }

        current.value.as_ref()
    }
}

impl<T: Clone> Default for TrieNode<T> {
    fn default() -> Self {
        Self::new()
    }
} 