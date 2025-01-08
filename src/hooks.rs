use std::future::Future;
use std::pin::Pin;
use hyper::{Request, Response, Body};
use crate::error::Error;

pub type PreRoutingHook = Box<dyn Fn(Request<Body>) -> Pin<Box<dyn Future<Output = Result<Request<Body>, Error>> + Send>> + Send + Sync>;
pub type PostHandlerHook = Box<dyn Fn(Response<Body>) -> Pin<Box<dyn Future<Output = Result<Response<Body>, Error>> + Send>> + Send + Sync>;
pub type ErrorHook = Box<dyn Fn(Error) -> Pin<Box<dyn Future<Output = Result<Response<Body>, Error>> + Send>> + Send + Sync>;

#[derive(Default)]
pub struct Hooks {
    pre_routing: Vec<PreRoutingHook>,
    post_handler: Vec<PostHandlerHook>,
    error_hooks: Vec<ErrorHook>,
}

impl Hooks {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add_pre_routing(&mut self, hook: PreRoutingHook) {
        self.pre_routing.push(hook);
    }

    pub fn add_post_handler(&mut self, hook: PostHandlerHook) {
        self.post_handler.push(hook);
    }

    pub fn add_error_hook(&mut self, hook: ErrorHook) {
        self.error_hooks.push(hook);
    }

    pub async fn execute_pre_routing(&self, mut request: Request<Body>) -> Result<Request<Body>, Error> {
        for hook in &self.pre_routing {
            request = hook(request).await?;
        }
        Ok(request)
    }

    pub async fn execute_post_handler(&self, mut response: Response<Body>) -> Result<Response<Body>, Error> {
        for hook in &self.post_handler {
            response = hook(response).await?;
        }
        Ok(response)
    }

    pub async fn execute_error_hooks(&self, error: Error) -> Result<Response<Body>, Error> {
        // Try each error hook in sequence until one succeeds
        for hook in &self.error_hooks {
            match hook(error.clone()).await {
                Ok(response) => return Ok(response),
                Err(_) => continue,
            }
        }
        // If no hook handles the error, return a default error response
        let mut response = Response::new(Body::from(format!("Error: {}", error)));
        *response.status_mut() = error.status_code();
        Ok(response)
    }
} 