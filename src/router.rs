use std::sync::Arc;
use hyper::{Body, Method, Request, Response};
use dashmap::DashMap;
use futures::future::BoxFuture;

use crate::error::Error;
use crate::hooks::Hooks;
use crate::middleware::MiddlewareChain;
use crate::trie::TrieNode;
use crate::types::{RouteHandler, RouteParams, Next};

#[derive(Clone)]
pub struct Router {
    routes: Arc<DashMap<Method, Arc<TrieNode>>>,
    middleware: Arc<MiddlewareChain>,
    hooks: Arc<Hooks>,
}

impl Router {
    pub fn new() -> Self {
        Self {
            routes: Arc::new(DashMap::new()),
            middleware: Arc::new(MiddlewareChain::new()),
            hooks: Arc::new(Hooks::new()),
        }
    }

    pub fn route(&self, method: Method, path: &str, handler: RouteHandler) -> Result<(), Error> {
        if let Some(trie) = self.routes.get(&method) {
            trie.insert(path, handler)?;
        } else {
            let trie = Arc::new(TrieNode::new());
            trie.insert(path, handler)?;
            self.routes.insert(method, trie);
        }
        Ok(())
    }

    pub fn get(&self, path: &str, handler: RouteHandler) -> Result<(), Error> {
        self.route(Method::GET, path, handler)
    }

    pub fn post(&self, path: &str, handler: RouteHandler) -> Result<(), Error> {
        self.route(Method::POST, path, handler)
    }

    pub fn put(&self, path: &str, handler: RouteHandler) -> Result<(), Error> {
        self.route(Method::PUT, path, handler)
    }

    pub fn delete(&self, path: &str, handler: RouteHandler) -> Result<(), Error> {
        self.route(Method::DELETE, path, handler)
    }

    pub fn with_middleware(&mut self, middleware: impl Into<Arc<MiddlewareChain>>) -> &mut Self {
        self.middleware = middleware.into();
        self
    }

    pub fn with_hooks(&mut self, hooks: impl Into<Arc<Hooks>>) -> &mut Self {
        self.hooks = hooks.into();
        self
    }

    pub async fn handle(&self, req: Request<Body>) -> Result<Response<Body>, Error> {
        let req = self.hooks.execute_pre_routing(req).await?;

        let method = req.method().clone();
        let path = req.uri().path();
        
        let mut params = RouteParams::default();
        
        let handler = match self.routes.get(&method) {
            Some(trie) => {
                match trie.find(path, &mut params) {
                    Some(handler) => {
                        Box::new(move |req: Request<Body>| -> BoxFuture<'static, Result<Response<Body>, Error>> {
                            Box::pin(handler(req))
                        }) as Next
                    }
                    None => return Err(Error::RouteNotFound(path.to_string())),
                }
            }
            None => return Err(Error::RouteNotFound(path.to_string())),
        };

        let req = self.hooks.execute_post_routing(req).await?;
        let req = self.hooks.execute_pre_handler(req).await?;

        let response = self.middleware.execute(req, handler).await?;
        let response = self.hooks.execute_post_handler(response).await?;
        Ok(response)
    }

    pub async fn serve(self, addr: std::net::SocketAddr) -> Result<(), Error> {
        let service = hyper::service::make_service_fn(move |_| {
            let router = self.clone();
            async move {
                Ok::<_, Error>(hyper::service::service_fn(move |req| {
                    let router = router.clone();
                    async move {
                        match router.handle(req).await {
                            Ok(response) => Ok::<_, Error>(response),
                            Err(err) => {
                                match router.hooks.execute_error_hooks(err).await {
                                    Ok(response) => Ok(response),
                                    Err(err) => {
                                        let mut response = Response::new(Body::from(err.to_string()));
                                        *response.status_mut() = err.status_code();
                                        Ok(response)
                                    }
                                }
                            }
                        }
                    }
                }))
            }
        });

        hyper::Server::bind(&addr)
            .serve(service)
            .await
            .map_err(|e| Error::Hyper(e.to_string()))
    }
}

impl Default for Router {
    fn default() -> Self {
        Self::new()
    }
} 