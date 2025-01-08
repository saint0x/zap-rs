use std::sync::Arc;
use hyper::{Body, Response};
use std::net::SocketAddr;
use zap_rust::middleware::MiddlewareChain;
use zap_rust::hooks::Hooks;

#[tokio::main]
async fn main() {
    // Create a new router
    let mut router = zap_rust::Router::new();

    // Add some routes
    router.get("/", Box::new(|_req| {
        Box::pin(async {
            Ok(Response::new(Body::from("Hello, World!")))
        })
    })).unwrap();

    router.get("/hello/:name", Box::new(|_req| {
        Box::pin(async {
            Ok(Response::new(Body::from("Hello, {name}!")))
        })
    })).unwrap();

    // Create middleware chain
    let chain = MiddlewareChain::new();
    chain.add(Box::new(|req, next| {
        Box::pin(async move {
            println!("Request to: {}", req.uri());
            next(req).await
        })
    }));

    // Create hooks
    let mut hooks = Hooks::new();
    hooks.add_pre_routing(Box::new(|req| {
        Box::pin(async move {
            println!("Pre-routing hook");
            Ok(req)
        })
    }));

    // Add middleware and hooks
    router
        .with_middleware(Arc::new(chain))
        .with_hooks(Arc::new(hooks));

    // Start the server
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("Server running on http://{}", addr);
    router.serve(addr).await.unwrap();
} 