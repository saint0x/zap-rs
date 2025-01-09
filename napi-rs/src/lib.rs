use napi_derive::napi;

mod error;
mod types;
mod store;
mod hooks;
mod router;
mod middleware;
mod handle;
mod trie;

pub use error::ZapError;
pub use types::{JsRequest, JsResponse};
pub use store::JsStore;
pub use hooks::JsHooks;
pub use router::JsRouter;

#[napi]
pub fn create_store() -> JsStore {
    JsStore::new()
}

#[napi]
pub fn create_hooks() -> JsHooks {
    JsHooks::new()
}

#[napi]
pub fn create_router() -> JsRouter {
    JsRouter::new()
} 