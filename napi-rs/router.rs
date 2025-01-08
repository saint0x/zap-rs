use std::sync::Arc;
use std::future::Future;
use hyper::{Request, Response, Body};
use crate::error::Error;
use crate::types::{RouteParams};
use crate::store::Store;
use crate::middleware::MiddlewareChain;
use crate::hooks::Hooks;
use crate::handle::Handle;

pub struct Router {
    store: Arc<Store>,
    middleware: Option<Arc<MiddlewareChain>>,
    hooks: Option<Arc<Hooks>>,
}

impl Router {
    pub fn new() -> Self {
        Self {
            store: Arc::new(Store::new()),
            middleware: None,
            hooks: None,
        }
    }

    pub fn get<F, Fut>(&mut self, path: &str, handler: F) -> Result<(), Error>
    where
        F: Fn(Request<Body>) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = Result<Response<Body>, Error>> + Send + 'static,
    {
        Arc::get_mut(&mut self.store)
            .ok_or_else(|| Error::Internal("Failed to get mutable reference to store".to_string()))?
            .register(path, Handle::new(handler))
    }

    pub fn post<F, Fut>(&mut self, path: &str, handler: F) -> Result<(), Error>
    where
        F: Fn(Request<Body>) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = Result<Response<Body>, Error>> + Send + 'static,
    {
        Arc::get_mut(&mut self.store)
            .ok_or_else(|| Error::Internal("Failed to get mutable reference to store".to_string()))?
            .register(path, Handle::new(handler))
    }

    pub fn with_middleware(&mut self, middleware: Arc<MiddlewareChain>) {
        self.middleware = Some(middleware);
    }

    pub fn with_hooks(&mut self, hooks: Arc<Hooks>) {
        self.hooks = Some(hooks);
    }

    pub async fn handle(&self, req: Request<Body>) -> Result<Response<Body>, Error> {
        // Execute pre-routing hooks
        let req = if let Some(hooks) = &self.hooks {
            hooks.execute_pre_routing(req).await?
        } else {
            req
        };

        // Find route and extract parameters
        let mut params = RouteParams::new();
        let handler = match self.store.lookup(req.uri().path(), &mut params)? {
            Some(h) => h,
            None => return Err(Error::RouteNotFound(req.uri().path().to_string())),
        };

        // Parse query parameters
        if let Some(query) = req.uri().query() {
            for pair in query.split('&') {
                if let Some((key, value)) = pair.split_once('=') {
                    params.query_params.insert(key.to_string(), value.to_string());
                }
            }
        }

        // Wrap the handler with middleware if present
        let response = if let Some(middleware) = &self.middleware {
            let handler = Arc::new(move |req| handler.call(req));
            let chain = middleware.compose(handler);
            chain(req).await
        } else {
            handler.call(req).await
        };

        // Handle the response or error
        match response {
            Ok(resp) => {
                if let Some(hooks) = &self.hooks {
                    hooks.execute_post_handler(resp).await
                } else {
                    Ok(resp)
                }
            }
            Err(err) => {
                if let Some(hooks) = &self.hooks {
                    hooks.execute_error_hooks(err).await
                } else {
                    let mut resp = Response::new(Body::from(format!("Error: {}", err)));
                    *resp.status_mut() = err.status_code();
                    Ok(resp)
                }
            }
        }
    }
}

impl Default for Router {
    fn default() -> Self {
        Self::new()
    }
} 