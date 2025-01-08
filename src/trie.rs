use std::sync::Arc;
use dashmap::DashMap;
use crate::error::Error;
use crate::types::{RouteParams, RouteHandler};

#[derive(Default)]
pub struct TrieNode {
    children: DashMap<String, Arc<TrieNode>>,
    param_child: DashMap<String, Arc<TrieNode>>,
    wildcard_child: DashMap<(), Arc<TrieNode>>,
    handler: DashMap<(), Arc<RouteHandler>>,
}

impl TrieNode {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn insert(&self, path: &str, handler: RouteHandler) -> Result<(), Error> {
        let segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
        let mut current = Arc::new(TrieNode::new());
        {
            // Copy all data from self to the new node
            for item in self.children.iter() {
                current.children.insert(item.key().clone(), item.value().clone());
            }
            for item in self.param_child.iter() {
                current.param_child.insert(item.key().clone(), item.value().clone());
            }
            for item in self.wildcard_child.iter() {
                current.wildcard_child.insert((), item.value().clone());
            }
            for item in self.handler.iter() {
                current.handler.insert((), item.value().clone());
            }
        }

        for segment in segments {
            let next_node = if segment.starts_with(':') {
                let param_name = segment[1..].to_string();
                if !current.param_child.contains_key(&param_name) {
                    let new_node = Arc::new(TrieNode::new());
                    current.param_child.insert(param_name.clone(), new_node);
                }
                current.param_child.get(&param_name).unwrap().value().clone()
            } else if segment == "*" {
                if current.wildcard_child.is_empty() {
                    let new_node = Arc::new(TrieNode::new());
                    current.wildcard_child.insert((), new_node);
                }
                current.wildcard_child.get(&()).unwrap().value().clone()
            } else {
                if !current.children.contains_key(segment) {
                    let new_node = Arc::new(TrieNode::new());
                    current.children.insert(segment.to_string(), new_node);
                }
                current.children.get(segment).unwrap().value().clone()
            };
            current = next_node;
        }

        current.handler.insert((), Arc::new(handler));
        Ok(())
    }

    pub fn find(&self, path: &str, params: &mut RouteParams) -> Option<RouteHandler> {
        let segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
        self.find_internal(&segments, 0, params)
    }

    fn find_internal(&self, segments: &[&str], index: usize, params: &mut RouteParams) -> Option<RouteHandler> {
        if index == segments.len() {
            return self.handler.get(&()).map(|h| {
                let handler = h.value().clone();
                Box::new(move |req| (*handler)(req)) as RouteHandler
            });
        }

        let segment = segments[index];

        // Try exact match first
        if let Some(child_ref) = self.children.get(segment) {
            let child = child_ref.value().clone();
            if let Some(handler) = child.find_internal(segments, index + 1, params) {
                return Some(handler);
            }
        }

        // Try parameter match
        for param_entry in self.param_child.iter() {
            let param_name = param_entry.key().clone();
            let child = param_entry.value().clone();
            params.path_params.insert(param_name.clone(), segment.to_string());
            if let Some(handler) = child.find_internal(segments, index + 1, params) {
                return Some(handler);
            }
            params.path_params.remove(&param_name);
        }

        // Try wildcard match
        if let Some(child_ref) = self.wildcard_child.get(&()) {
            let child = child_ref.value().clone();
            return child.find_internal(segments, index + 1, params);
        }

        None
    }
} 