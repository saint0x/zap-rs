//! Handler traits and implementations for ZapServer

use std::future::Future;
use std::pin::Pin;

use crate::error::ZapError;
use crate::response::ZapResponse;
use zap_core::Request;
use crate::request::RequestData;

/// Handler trait for request processing
pub trait Handler {
    /// Handle the request and return a response
    fn handle<'a>(
        &'a self,
        req: Request<'a>,
    ) -> Pin<Box<dyn Future<Output = Result<ZapResponse, ZapError>> + Send + 'a>>;
}

/// Implement Handler for simple closures that return strings
impl<F> Handler for F
where
    F: Fn() -> &'static str + Send + Sync,
{
    fn handle<'a>(
        &'a self,
        _req: Request<'a>,
    ) -> Pin<Box<dyn Future<Output = Result<ZapResponse, ZapError>> + Send + 'a>> {
        let response = self();
        Box::pin(async move { Ok(ZapResponse::Text(response.to_string())) })
    }
}

/// Simple handler that returns a ZapResponse
pub struct SimpleHandler<F> {
    func: F,
}

impl<F> SimpleHandler<F> {
    pub fn new(func: F) -> Self {
        Self { func }
    }
}

impl<F> Handler for SimpleHandler<F>
where
    F: Fn() -> String + Send + Sync,
{
    fn handle<'a>(
        &'a self,
        _req: Request<'a>,
    ) -> Pin<Box<dyn Future<Output = Result<ZapResponse, ZapError>> + Send + 'a>> {
        let response = (self.func)();
        Box::pin(async move { Ok(ZapResponse::Text(response)) })
    }
}

/// Async handler wrapper
pub struct AsyncHandler<F> {
    func: F,
}

impl<F> AsyncHandler<F> {
    pub fn new(func: F) -> Self {
        Self { func }
    }
}

impl<F, Fut> Handler for AsyncHandler<F>
where
    F: Fn(RequestData) -> Fut + Send + Sync,
    Fut: Future<Output = ZapResponse> + Send,
{
    fn handle<'a>(
        &'a self,
        req: Request<'a>,
    ) -> Pin<Box<dyn Future<Output = Result<ZapResponse, ZapError>> + Send + 'a>> {
        // Extract request data that can be moved
        let req_data = RequestData::from_request(&req);
        
        Box::pin(async move {
            let response = (self.func)(req_data).await;
            Ok(response)
        })
    }
}

/// Type alias for boxed async handlers
pub type BoxedHandler = Box<dyn Handler + Send + Sync>; 