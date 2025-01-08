use std::collections::HashMap;
use crate::handle::Handle;

pub type RouteHandler = Handle;

#[derive(Default)]
pub struct RouteParams {
    pub path_params: HashMap<String, String>,
    pub query_params: HashMap<String, String>,
}

impl RouteParams {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn get_path_param(&self, name: &str) -> Option<&String> {
        self.path_params.get(name)
    }

    pub fn get_query_param(&self, name: &str) -> Option<&String> {
        self.query_params.get(name)
    }
} 