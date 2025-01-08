use futures::future::BoxFuture;
use hyper::{Body, Request, Response};
use crate::error::Error;

pub type HookFn = Box<dyn Fn(Request<Body>) -> BoxFuture<'static, Result<Request<Body>, Error>> + Send + Sync>;
pub type ResponseHookFn = Box<dyn Fn(Response<Body>) -> BoxFuture<'static, Result<Response<Body>, Error>> + Send + Sync>;

#[derive(Default)]
pub struct Hooks {
    // Pre-routing hooks
    pre_routing: Vec<HookFn>,
    // Post-routing hooks
    post_routing: Vec<HookFn>,
    // Pre-handler hooks
    pre_handler: Vec<HookFn>,
    // Post-handler hooks
    post_handler: Vec<ResponseHookFn>,
    // Error hooks
    error_hooks: Vec<Box<dyn Fn(Error) -> BoxFuture<'static, Result<Response<Body>, Error>> + Send + Sync>>,
}

impl Hooks {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add_pre_routing(&mut self, hook: HookFn) {
        self.pre_routing.push(hook);
    }

    pub fn add_post_routing(&mut self, hook: HookFn) {
        self.post_routing.push(hook);
    }

    pub fn add_pre_handler(&mut self, hook: HookFn) {
        self.pre_handler.push(hook);
    }

    pub fn add_post_handler(&mut self, hook: ResponseHookFn) {
        self.post_handler.push(hook);
    }

    pub fn add_error_hook(&mut self, hook: Box<dyn Fn(Error) -> BoxFuture<'static, Result<Response<Body>, Error>> + Send + Sync>) {
        self.error_hooks.push(hook);
    }

    pub async fn execute_pre_routing(&self, req: Request<Body>) -> Result<Request<Body>, Error> {
        let mut current_req = req;
        for hook in &self.pre_routing {
            current_req = hook(current_req).await?;
        }
        Ok(current_req)
    }

    pub async fn execute_post_routing(&self, req: Request<Body>) -> Result<Request<Body>, Error> {
        let mut current_req = req;
        for hook in &self.post_routing {
            current_req = hook(current_req).await?;
        }
        Ok(current_req)
    }

    pub async fn execute_pre_handler(&self, req: Request<Body>) -> Result<Request<Body>, Error> {
        let mut current_req = req;
        for hook in &self.pre_handler {
            current_req = hook(current_req).await?;
        }
        Ok(current_req)
    }

    pub async fn execute_post_handler(&self, res: Response<Body>) -> Result<Response<Body>, Error> {
        let mut current_res = res;
        for hook in &self.post_handler {
            current_res = hook(current_res).await?;
        }
        Ok(current_res)
    }

    pub async fn execute_error_hooks(&self, err: Error) -> Result<Response<Body>, Error> {
        for hook in &self.error_hooks {
            match hook(err.clone()).await {
                Ok(response) => return Ok(response),
                Err(_) => continue,
            }
        }
        Err(err)
    }
} 