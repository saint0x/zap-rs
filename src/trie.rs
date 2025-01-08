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
        let segments: Vec<&str> = path.split('/')
            .filter(|s| !s.is_empty())
            .collect();

        let mut current = self;

        for segment in segments {
            current = if segment.starts_with(':') {
                let param_name = segment[1..].to_string();
                let entry = current.param_child.entry(param_name);
                let node = entry.or_insert_with(|| Arc::new(TrieNode::new()));
                Arc::as_ref(node)
            } else if segment == "*" {
                let entry = current.wildcard_child.entry(());
                let node = entry.or_insert_with(|| Arc::new(TrieNode::new()));
                Arc::as_ref(node)
            } else {
                let entry = current.children.entry(segment.to_string());
                let node = entry.or_insert_with(|| Arc::new(TrieNode::new()));
                Arc::as_ref(node)
            };
        }

        current.handler.insert((), Arc::new(handler));
        Ok(())
    }

    pub fn find(&self, path: &str, params: &mut RouteParams) -> Option<RouteHandler> {
        let segments: Vec<&str> = path.split('/')
            .filter(|s| !s.is_empty())
            .collect();
        self.find_internal(&segments, 0, params)
    }

    fn find_internal(&self, segments: &[&str], index: usize, params: &mut RouteParams) -> Option<RouteHandler> {
        if index == segments.len() {
            return self.handler.get(&()).map(|h| {
                let handler = h.value().clone();
                let boxed: Box<dyn Fn(hyper::Request<Body>) -> Pin<Box<dyn Future<Output = Result<Response<Body>, Error>> + Send>> + Send + Sync> = 
                    Box::new(move |req| handler(req));
                boxed
            });
        }

        let segment = segments[index];

        // Try exact match first
        if let Some(child) = self.children.get(segment) {
            if let Some(handler) = child.find_internal(segments, index + 1, params) {
                return Some(handler);
            }
        }

        // Try parameter match
        for entry in self.param_child.iter() {
            let param_name = entry.key().clone();
            params.path_params.insert(param_name.clone(), segment.to_string());
            if let Some(handler) = entry.value().find_internal(segments, index + 1, params) {
                return Some(handler);
            }
            params.path_params.remove(&param_name);
        }

        // Try wildcard match
        if let Some(child) = self.wildcard_child.get(&()) {
            return child.find_internal(segments, index + 1, params);
        }

        None
    }
} 