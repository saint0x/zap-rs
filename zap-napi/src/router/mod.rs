mod trie;

use std::sync::Mutex;
use std::sync::atomic::{AtomicU32, Ordering};
use std::collections::HashMap;
use napi::{Result, JsObject, Env, NapiRaw, sys};
use napi_derive::napi;
use napi::bindgen_prelude::ToNapiValue;
use crate::hooks::Hooks;
use crate::middleware::MiddlewareChain;

pub use trie::{RouteParams, TrieNode};

type HandlerId = u32;

#[derive(Debug)]
pub struct HandlerInfo {
    pub id: HandlerId,
    pub params: RouteParams,
}

impl ToNapiValue for HandlerInfo {
    unsafe fn to_napi_value(env: sys::napi_env, val: Self) -> Result<sys::napi_value> {
        let mut obj = Env::from_raw(env).create_object()?;
        obj.set("id", val.id)?;
        obj.set("params", val.params)?;
        Ok(obj.raw())
    }
}

#[napi(object)]
pub struct RouteConfig {
    pub middleware: Option<Vec<u32>>,
    pub guards: Option<Vec<u32>>,
    pub validation: Option<JsObject>,
    pub transform: Option<JsObject>,
}

#[napi(js_name = "Router")]
pub struct Router {
    routes: Mutex<TrieNode>,
    next_id: AtomicU32,
    hooks: Hooks,
    middleware_chain: MiddlewareChain,
    route_configs: Mutex<HashMap<HandlerId, RouteConfig>>,
}

#[napi]
impl Router {
    #[napi(constructor)]
    pub fn new(hooks: Hooks) -> Self {
        Self {
            routes: Mutex::new(TrieNode::new()),
            next_id: AtomicU32::new(1),
            hooks,
            middleware_chain: MiddlewareChain::new(),
            route_configs: Mutex::new(HashMap::new()),
        }
    }

    #[napi]
    pub fn register_middleware(&self, env: Env, middleware: JsObject) -> Result<u32> {
        self.middleware_chain.register(env, middleware)
    }

    #[napi]
    pub fn register(&self, method: String, path: String, config: Option<RouteConfig>) -> Result<HandlerId> {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let mut routes = self.routes.lock().unwrap();
        let full_path = format!("{}/{}", method, path);
        routes.insert(&full_path, id);

        if let Some(config) = config {
            let mut configs = self.route_configs.lock().unwrap();
            configs.insert(id, config);
        }

        Ok(id)
    }

    #[napi(js_name = "getHandlerInfo")]
    pub fn get_handler_info(&self, method: String, path: String) -> Result<Option<HandlerInfo>> {
        Ok(if let Ok(routes) = self.routes.lock() {
            let full_path = format!("{}/{}", method, path);
            routes.find(&full_path).map(|(id, params)| HandlerInfo { id, params })
        } else {
            None
        })
    }

    #[napi]
    pub fn get_middleware_chain(&self, handler_id: HandlerId) -> Option<Vec<JsObject>> {
        let configs = self.route_configs.lock().unwrap();
        if let Some(config) = configs.get(&handler_id) {
            if let Some(middleware_ids) = &config.middleware {
                let middlewares = self.middleware_chain.get_middlewares(middleware_ids);
                return Some(middlewares.into_iter()
                    .filter_map(|m| m.lock().unwrap().take())
                    .collect());
            }
        }
        None
    }

    #[napi]
    pub fn get_guards(&self, handler_id: HandlerId) -> Option<Vec<JsObject>> {
        let configs = self.route_configs.lock().unwrap();
        if let Some(config) = configs.get(&handler_id) {
            if let Some(guard_ids) = &config.guards {
                let guards = self.middleware_chain.get_middlewares(guard_ids);
                return Some(guards.into_iter()
                    .filter_map(|g| g.lock().unwrap().take())
                    .collect());
            }
        }
        None
    }

    #[napi]
    pub fn get_validation(&self, handler_id: HandlerId) -> Option<JsObject> {
        let mut configs = self.route_configs.lock().unwrap();
        configs.get_mut(&handler_id)
            .and_then(|config| config.validation.take())
    }

    #[napi]
    pub fn get_transform(&self, handler_id: HandlerId) -> Option<JsObject> {
        let mut configs = self.route_configs.lock().unwrap();
        configs.get_mut(&handler_id)
            .and_then(|config| config.transform.take())
    }
} 