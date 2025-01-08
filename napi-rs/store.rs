use std::collections::HashMap;
use hyper::{Request, Response, Body, Method};
use crate::error::Error;
use crate::handle::Handle;
use crate::trie::TrieNode;
use crate::types::RouteParams;

pub struct Store {
    routes: HashMap<Method, TrieNode<Handle>>,
}

impl Store {
    pub fn new() -> Self {
        Self {
            routes: HashMap::new(),
        }
    }

    pub fn register(&mut self, path: &str, handler: Handle) -> Result<(), Error> {
        let method = Method::GET; // Default to GET for now
        let trie = self.routes.entry(method.clone()).or_insert_with(TrieNode::new);
        trie.insert(path, handler);
        Ok(())
    }

    pub fn register_method(&mut self, method: Method, path: &str, handler: Handle) -> Result<(), Error> {
        let trie = self.routes.entry(method).or_insert_with(TrieNode::new);
        trie.insert(path, handler);
        Ok(())
    }

    pub fn lookup(&self, path: &str, params: &mut RouteParams) -> Result<Option<&Handle>, Error> {
        let method = Method::GET; // Default to GET for now
        if let Some(trie) = self.routes.get(&method) {
            Ok(trie.lookup(path, &mut params.path_params))
        } else {
            Ok(None)
        }
    }

    pub fn lookup_method(&self, method: &Method, path: &str, params: &mut RouteParams) -> Result<Option<&Handle>, Error> {
        if let Some(trie) = self.routes.get(method) {
            Ok(trie.lookup(path, &mut params.path_params))
        } else {
            Ok(None)
        }
    }
}

impl Default for Store {
    fn default() -> Self {
        Self::new()
    }
} 