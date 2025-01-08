use std::sync::Arc;
use std::net::SocketAddr;
use hyper::{Body, Response};
use zap_rs::middleware::MiddlewareChain;
use zap_rs::hooks::Hooks;

#[tokio::main]
async fn main() {
    // Create a new router
    let mut router = zap_rs::Router::new();

    // Add a simple route
    router.get("/", |_req| async {
        Ok(Response::new(Body::from("Hello, World!")))
    }).unwrap();

    // Add middleware
    let mut chain = MiddlewareChain::new();
    chain.add(Arc::new(|req, next| {
        Box::pin(async move {
            println!("Request to: {}", req.uri());
            next(req).await
        })
    }));
    router.with_middleware(Arc::new(chain));

    // Add hooks
    let mut hooks = Hooks::new();
    hooks.add_pre_routing(Box::new(|req| {
        Box::pin(async move {
            println!("Pre-routing hook");
            Ok(req)
        })
    }));
    router.with_hooks(Arc::new(hooks));

    // Start the server
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("Server running on http://{}", addr);
} 