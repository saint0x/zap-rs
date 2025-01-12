use crate::error::ZapError;
use crate::types::{JsRequest, JsResponse};
use napi::bindgen_prelude::*;

pub type Next = Box<dyn FnOnce(JsRequest) -> napi::Result<JsResponse>>;
pub type Middleware = Box<dyn Fn(JsRequest, Next) -> napi::Result<JsResponse>>;

struct MiddlewareEntry {
    handler: Middleware,
    cleanup: Option<Box<dyn Fn()>>,
}

pub struct MiddlewareChain {
    handlers: Vec<MiddlewareEntry>,
}

impl MiddlewareChain {
    pub fn new() -> Self {
        Self {
            handlers: Vec::new(),
        }
    }

    pub fn add(&mut self, middleware: Middleware, cleanup: Option<Box<dyn Fn()>>) {
        self.handlers.push(MiddlewareEntry {
            handler: middleware,
            cleanup,
        });
    }

    pub fn execute(&self, request: JsRequest) -> napi::Result<JsResponse> {
        if self.handlers.is_empty() {
            return Ok(JsResponse::default());
        }

        let mut cleanup_stack = Vec::new();
        
        fn execute_middleware(
            index: usize,
            request: JsRequest,
            handlers: &[MiddlewareEntry],
            cleanup_stack: &mut Vec<Box<dyn Fn()>>,
        ) -> napi::Result<JsResponse> {
            if index >= handlers.len() {
                return Ok(JsResponse::default());
            }
            
            let entry = &handlers[index];
            if let Some(cleanup) = &entry.cleanup {
                cleanup_stack.push(cleanup.clone());
            }
            
            let handler = &entry.handler;
            let next = Box::new(move |req: JsRequest| {
                execute_middleware(index + 1, req, handlers, cleanup_stack)
            });
            
            handler(request, next)
        }
        
        let result = execute_middleware(0, request, &self.handlers, &mut cleanup_stack);
        
        // Execute cleanup functions in reverse order
        for cleanup in cleanup_stack.into_iter().rev() {
            cleanup();
        }
        
        result
    }
} 