use napi_derive::napi;
use napi::{Result, JsObject, Env};

pub mod router;
pub mod hooks;
pub mod middleware;

pub use router::{Router, RouteConfig, RouteParams};
pub use middleware::{MiddlewareChain, Guard};

#[napi]
pub fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[napi]
#[derive(Debug)]
pub struct NativeHooks {
    inner: hooks::Hooks,
}

#[napi]
impl NativeHooks {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            inner: hooks::Hooks::new()
        }
    }

    #[napi]
    pub fn register_pre_routing(&self, name: String) -> Result<u32> {
        self.inner.register_pre_routing(name)
    }

    #[napi]
    pub fn register_post_handler(&self, name: String) -> Result<u32> {
        self.inner.register_post_handler(name)
    }

    #[napi]
    pub fn register_error_handler(&self, name: String) -> Result<u32> {
        self.inner.register_error_handler(name)
    }

    #[napi]
    pub fn get_pre_routing_hooks(&self, env: Env) -> Result<JsObject> {
        self.inner.get_pre_routing_hooks(env)
    }

    #[napi]
    pub fn get_post_handler_hooks(&self, env: Env) -> Result<JsObject> {
        self.inner.get_post_handler_hooks(env)
    }

    #[napi]
    pub fn get_error_handler_hooks(&self, env: Env) -> Result<JsObject> {
        self.inner.get_error_handler_hooks(env)
    }
}