#[cfg(test)]
mod tests {
    use std::sync::Arc;
    use hyper::{Body, Method, Request, Response, StatusCode};
    use zap_rs::{Router, Error, middleware::MiddlewareChain, hooks::Hooks};

    // Helper function to create test requests
    fn create_test_request(method: Method, uri: &str) -> Request<Body> {
        Request::builder()
            .method(method)
            .uri(uri)
            .body(Body::empty())
            .unwrap()
    }

    // Helper function to read response body
    async fn read_response_body(response: Response<Body>) -> String {
        let body_bytes = hyper::body::to_bytes(response.into_body()).await.unwrap();
        String::from_utf8(body_bytes.to_vec()).unwrap()
    }

    #[tokio::test]
    async fn test_basic_routing() {
        let mut router = Router::new();
        
        // Register routes
        router.get("/", |_req| async {
            Ok(Response::new(Body::from("Hello, World!")))
        }).unwrap();

        router.post("/users", |_req| async {
            Ok(Response::new(Body::from("User created")))
        }).unwrap();

        // Test GET request
        let req = create_test_request(Method::GET, "/");
        let resp = router.handle(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        assert_eq!(read_response_body(resp).await, "Hello, World!");

        // Test POST request
        let req = create_test_request(Method::POST, "/users");
        let resp = router.handle(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        assert_eq!(read_response_body(resp).await, "User created");

        // Test non-existent route
        let req = create_test_request(Method::GET, "/nonexistent");
        let result = router.handle(req).await;
        assert!(matches!(result, Err(Error::RouteNotFound(_))));
    }

    #[tokio::test]
    async fn test_path_parameters() {
        let mut router = Router::new();
        
        router.get("/users/:id", |req| async move {
            let uri = req.uri().path();
            Ok(Response::new(Body::from(format!("User ID: {}", uri.split('/').last().unwrap()))))
        }).unwrap();

        // Test with parameter
        let req = create_test_request(Method::GET, "/users/123");
        let resp = router.handle(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        assert_eq!(read_response_body(resp).await, "User ID: 123");
    }

    #[tokio::test]
    async fn test_middleware_chain() {
        let mut router = Router::new();
        let mut chain = MiddlewareChain::new();
        
        // Add middleware that adds a custom header
        chain.add(Arc::new(|req, next| {
            Box::pin(async move {
                let mut response = next(req).await?;
                response.headers_mut().insert(
                    "X-Custom-Header",
                    hyper::header::HeaderValue::from_static("test-value")
                );
                Ok(response)
            })
        }));

        router.with_middleware(Arc::new(chain));
        
        router.get("/test", |_req| async {
            Ok(Response::new(Body::from("test")))
        }).unwrap();

        let req = create_test_request(Method::GET, "/test");
        let resp = router.handle(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        assert_eq!(
            resp.headers().get("X-Custom-Header").unwrap(),
            "test-value"
        );
    }

    #[tokio::test]
    async fn test_hooks() {
        let mut router = Router::new();
        let mut hooks = Hooks::new();
        
        // Add pre-routing hook
        hooks.add_pre_routing(Box::new(|req| {
            Box::pin(async move {
                let mut req = req;
                req.headers_mut().insert(
                    "X-Pre-Route",
                    hyper::header::HeaderValue::from_static("pre-route-value")
                );
                Ok(req)
            })
        }));

        // Add post-handler hook
        hooks.add_post_handler(Box::new(|resp| {
            Box::pin(async move {
                let mut resp = resp;
                resp.headers_mut().insert(
                    "X-Post-Handler",
                    hyper::header::HeaderValue::from_static("post-handler-value")
                );
                Ok(resp)
            })
        }));

        router.with_hooks(Arc::new(hooks));
        
        router.get("/hook-test", |req| async move {
            assert!(req.headers().contains_key("X-Pre-Route"));
            Ok(Response::new(Body::from("hook test")))
        }).unwrap();

        let req = create_test_request(Method::GET, "/hook-test");
        let resp = router.handle(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        assert_eq!(
            resp.headers().get("X-Post-Handler").unwrap(),
            "post-handler-value"
        );
    }

    #[tokio::test]
    async fn test_error_handling() {
        let mut router = Router::new();
        let mut hooks = Hooks::new();
        
        // Add error hook
        hooks.add_error_hook(Box::new(|err| {
            Box::pin(async move {
                let mut resp = Response::new(Body::from(format!("Error handled: {}", err)));
                *resp.status_mut() = err.status_code();
                Ok(resp)
            })
        }));

        router.with_hooks(Arc::new(hooks));
        
        // Route that always errors
        router.get("/error", |_req| async {
            Err(Error::Internal("Test error".to_string()))
        }).unwrap();

        let req = create_test_request(Method::GET, "/error");
        let resp = router.handle(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::INTERNAL_SERVER_ERROR);
        assert!(read_response_body(resp).await.contains("Test error"));
    }
} 