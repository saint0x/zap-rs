use dashmap::DashMap;
use crate::error::Error;
use crate::types::{RouteHandler, RouteParams};

// Immutable route storage after registration
pub struct Store {
    routes: DashMap<String, RouteEntry>,
}

struct RouteEntry {
    handler: RouteHandler,
    params: Vec<String>,
    is_wildcard: bool,
}

impl Store {
    pub fn new() -> Self {
        Self {
            routes: DashMap::new(),
        }
    }

    // Registration is single-threaded at startup
    pub fn register(&self, path: &str, handler: RouteHandler) -> Result<(), Error> {
        let (normalized_path, params) = self.normalize_path(path);
        let entry = RouteEntry {
            handler,
            params,
            is_wildcard: path.contains('*'),
        };
        self.routes.insert(normalized_path, entry);
        Ok(())
    }

    // O(1) lookup with param extraction
    pub fn lookup(&self, path: &str, params: &mut RouteParams) -> Option<RouteHandler> {
        let path_segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
        
        // Try exact match first
        if let Some(entry) = self.routes.get(path) {
            return Some(entry.handler.clone());
        }

        // Try parameterized routes
        for entry in self.routes.iter() {
            let stored_path = entry.key();
            let entry_segments: Vec<&str> = stored_path.split('/').filter(|s| !s.is_empty()).collect();
            
            if path_segments.len() != entry_segments.len() && !entry.value().is_wildcard {
                continue;
            }

            if self.matches_route(&path_segments, &entry_segments, &entry.value().params, params) {
                return Some(entry.value().handler.clone());
            }
        }

        None
    }

    fn normalize_path(&self, path: &str) -> (String, Vec<String>) {
        let segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
        let mut params = Vec::new();
        let normalized = segments
            .iter()
            .map(|&s| {
                if s.starts_with(':') {
                    params.push(s[1..].to_string());
                    ":param".to_string()
                } else {
                    s.to_string()
                }
            })
            .collect::<Vec<_>>()
            .join("/");
        (format!("/{}", normalized), params)
    }

    fn matches_route(&self, path_segments: &[&str], stored_segments: &[&str], param_names: &[String], route_params: &mut RouteParams) -> bool {
        if path_segments.len() != stored_segments.len() {
            return false;
        }

        let mut param_index = 0;
        for (i, stored) in stored_segments.iter().enumerate() {
            if *stored == ":param" {
                if i < path_segments.len() {
                    if param_index < param_names.len() {
                        route_params.path_params.insert(param_names[param_index].clone(), path_segments[i].to_string());
                        param_index += 1;
                    }
                } else {
                    return false;
                }
            } else if *stored == "*" {
                return true;
            } else if i >= path_segments.len() || *stored != path_segments[i] {
                return false;
            }
        }
        true
    }
} 