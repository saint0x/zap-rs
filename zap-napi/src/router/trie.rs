use std::collections::HashMap;
use std::sync::Arc;
use napi::{Result, sys, Env, NapiRaw};
use napi::bindgen_prelude::ToNapiValue;

#[derive(Debug, Clone)]
pub struct RouteParams {
    pub params: HashMap<String, String>,
}

impl RouteParams {
    pub fn new() -> Self {
        Self {
            params: HashMap::new(),
        }
    }

    pub fn insert(&mut self, key: String, value: String) {
        self.params.insert(key, value);
    }
}

impl ToNapiValue for RouteParams {
    unsafe fn to_napi_value(env: sys::napi_env, val: Self) -> Result<sys::napi_value> {
        let mut obj = Env::from_raw(env).create_object()?;
        for (key, value) in val.params {
            obj.set(&key, value)?;
        }
        Ok(obj.raw())
    }
}

#[derive(Debug, Clone)]
pub struct TrieNode {
    // Static children (exact matches)
    children: HashMap<String, Arc<TrieNode>>,
    // Parameter children (like :id)
    param_child: Option<(String, Arc<TrieNode>)>,
    // Wildcard child (like *)
    wildcard_child: Option<Arc<TrieNode>>,
    // Handler ID if this is an endpoint
    handler_id: Option<u32>,
}

impl TrieNode {
    pub fn new() -> Self {
        Self {
            children: HashMap::new(),
            param_child: None,
            wildcard_child: None,
            handler_id: None,
        }
    }

    pub fn insert(&mut self, path: &str, handler_id: u32) {
        if path.is_empty() {
            self.handler_id = Some(handler_id);
            return;
        }

        let segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
        let mut current = self;

        for segment in segments {
            if segment.starts_with(':') {
                let param_name = segment[1..].to_string();
                if current.param_child.is_none() {
                    current.param_child = Some((param_name.clone(), Arc::new(TrieNode::new())));
                }
                let (_, node) = current.param_child.as_mut().unwrap();
                if Arc::strong_count(node) > 1 {
                    let new_node = node.as_ref().clone();
                    *node = Arc::new(new_node);
                }
                let node_ref = Arc::get_mut(node).unwrap();
                current = node_ref;
            } else if segment == "*" {
                if current.wildcard_child.is_none() {
                    current.wildcard_child = Some(Arc::new(TrieNode::new()));
                }
                let node = current.wildcard_child.as_mut().unwrap();
                if Arc::strong_count(node) > 1 {
                    let new_node = node.as_ref().clone();
                    *node = Arc::new(new_node);
                }
                let node_ref = Arc::get_mut(node).unwrap();
                current = node_ref;
            } else {
                if !current.children.contains_key(segment) {
                    current.children.insert(segment.to_string(), Arc::new(TrieNode::new()));
                }
                let node = current.children.get_mut(segment).unwrap();
                if Arc::strong_count(node) > 1 {
                    let new_node = node.as_ref().clone();
                    *node = Arc::new(new_node);
                }
                let node_ref = Arc::get_mut(node).unwrap();
                current = node_ref;
            }
        }

        current.handler_id = Some(handler_id);
    }

    pub fn find(&self, path: &str) -> Option<(u32, RouteParams)> {
        let segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
        let mut params = RouteParams::new();
        self.find_internal(&segments, &mut params)
    }

    fn find_internal(&self, segments: &[&str], params: &mut RouteParams) -> Option<(u32, RouteParams)> {
        if segments.is_empty() {
            return self.handler_id.map(|id| (id, params.clone()));
        }

        let segment = segments[0];
        let remaining = &segments[1..];

        // Try exact match first
        if let Some(child) = self.children.get(segment) {
            if let Some(result) = child.find_internal(remaining, params) {
                return Some(result);
            }
        }

        // Try parameter match
        if let Some((param_name, child)) = &self.param_child {
            let mut new_params = params.clone();
            new_params.insert(param_name.clone(), segment.to_string());
            if let Some(result) = child.find_internal(remaining, &mut new_params) {
                return Some(result);
            }
        }

        // Try wildcard match
        if let Some(child) = &self.wildcard_child {
            let mut new_params = params.clone();
            new_params.insert("*".to_string(), segments.join("/"));
            if let Some(result) = child.find_internal(&[], &mut new_params) {
                return Some(result);
            }
        }

        None
    }
} 