use std::sync::Arc;
use napi::{Result, JsObject, Env};
use std::collections::HashMap;
use std::sync::Mutex;
use std::sync::atomic::{AtomicU32, Ordering};

type MiddlewareId = u32;
type MiddlewareFn = Arc<Mutex<Option<JsObject>>>;

#[derive(Clone)]
pub struct MiddlewareChain {
    middlewares: Arc<Mutex<HashMap<MiddlewareId, MiddlewareFn>>>,
    next_id: Arc<AtomicU32>,
}

impl MiddlewareChain {
    pub fn new() -> Self {
        Self {
            middlewares: Arc::new(Mutex::new(HashMap::new())),
            next_id: Arc::new(AtomicU32::new(1)),
        }
    }

    pub fn register(&self, _env: Env, middleware: JsObject) -> Result<MiddlewareId> {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let mut middlewares = self.middlewares.lock().unwrap();
        middlewares.insert(id, Arc::new(Mutex::new(Some(middleware))));
        Ok(id)
    }

    pub fn get_middleware(&self, id: MiddlewareId) -> Option<MiddlewareFn> {
        self.middlewares.lock().unwrap().get(&id).cloned()
    }

    pub fn get_middlewares(&self, ids: &[MiddlewareId]) -> Vec<MiddlewareFn> {
        let middlewares = self.middlewares.lock().unwrap();
        ids.iter()
            .filter_map(|id| middlewares.get(id))
            .cloned()
            .collect()
    }
}

#[derive(Clone)]
pub struct Guard {
    chain: MiddlewareChain,
    guard_ids: Vec<MiddlewareId>,
}

impl Guard {
    pub fn new(chain: MiddlewareChain) -> Self {
        Self {
            chain,
            guard_ids: Vec::new(),
        }
    }

    pub fn add_guard(&mut self, id: MiddlewareId) {
        self.guard_ids.push(id);
    }

    pub fn get_guards(&self) -> Vec<MiddlewareFn> {
        self.chain.get_middlewares(&self.guard_ids)
    }
} 