use std::future::Future;
use std::pin::Pin;
use hyper::{Body, Request, Response};

pub type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;
pub type RouteHandler = Box<dyn Fn(Request<Body>) -> BoxFuture<'static, Result<Response<Body>, Error>> + Send + Sync>;
pub type Middleware = Box<dyn Fn(Request<Body>, Next) -> BoxFuture<'static, Result<Response<Body>, Error>> + Send + Sync>;
pub type Next = Box<dyn Fn(Request<Body>) -> BoxFuture<'static, Result<Response<Body>, Error>> + Send + Sync>;

#[derive(Debug, Clone)]
pub struct RouteParams {
    pub path_params: dashmap::DashMap<String, String>,
    pub query_params: dashmap::DashMap<String, String>,
}

impl Default for RouteParams {
    fn default() -> Self {
        Self {
            path_params: dashmap::DashMap::new(),
            query_params: dashmap::DashMap::new(),
        }
    }
}

use crate::error::Error; 