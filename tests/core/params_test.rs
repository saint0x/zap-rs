#[cfg(test)]
mod tests {
    use hyper::{Body, Method, Request, Response, StatusCode};
    use zap_rs::{Router, Error};

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
    async fn test_path_parameter_extraction() {
        let mut router = Router::new();
        
        // Route with multiple parameters
        router.get("/users/:id/posts/:post_id", |req| async move {
            let uri = req.uri().path();
            let segments: Vec<&str> = uri.split('/').collect();
            let user_id = segments[2];
            let post_id = segments[4];
            Ok(Response::new(Body::from(format!("User {} Post {}", user_id, post_id))))
        }).unwrap();

        // Test with parameters
        let req = create_test_request(Method::GET, "/users/123/posts/456");
        let resp = router.handle(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        assert_eq!(read_response_body(resp).await, "User 123 Post 456");
    }

    #[tokio::test]
    async fn test_query_parameter_handling() {
        let mut router = Router::new();
        
        // Route that handles query parameters
        router.get("/search", |req| async move {
            let query = req.uri().query().unwrap_or("");
            Ok(Response::new(Body::from(format!("Query: {}", query))))
        }).unwrap();

        // Test with query parameters
        let req = create_test_request(Method::GET, "/search?q=test&page=1");
        let resp = router.handle(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        assert_eq!(read_response_body(resp).await, "Query: q=test&page=1");
    }

    #[tokio::test]
    async fn test_mixed_parameters() {
        let mut router = Router::new();
        
        // Route with both path and query parameters
        router.get("/users/:id", |req| async move {
            let uri = req.uri();
            let path = uri.path();
            let query = uri.query().unwrap_or("");
            let user_id = path.split('/').last().unwrap();
            Ok(Response::new(Body::from(format!("User {} Query {}", user_id, query))))
        }).unwrap();

        // Test with both parameter types
        let req = create_test_request(Method::GET, "/users/123?role=admin");
        let resp = router.handle(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        assert_eq!(read_response_body(resp).await, "User 123 Query role=admin");
    }

    #[tokio::test]
    async fn test_optional_parameters() {
        let mut router = Router::new();
        
        // Route with optional query parameters
        router.get("/items", |req| async move {
            let query = req.uri().query().unwrap_or("no params");
            Ok(Response::new(Body::from(format!("Items with {}", query))))
        }).unwrap();

        // Test without query parameters
        let req = create_test_request(Method::GET, "/items");
        let resp = router.handle(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        assert_eq!(read_response_body(resp).await, "Items with no params");

        // Test with query parameters
        let req = create_test_request(Method::GET, "/items?page=1&limit=10");
        let resp = router.handle(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        assert_eq!(read_response_body(resp).await, "Items with page=1&limit=10");
    }

    #[tokio::test]
    async fn test_invalid_parameters() {
        let mut router = Router::new();
        
        // Route expecting specific parameter format
        router.get("/users/:id", |req| async move {
            let uri = req.uri().path();
            let user_id = uri.split('/').last().unwrap();
            if !user_id.chars().all(char::is_numeric) {
                return Err(Error::Internal("User ID must be numeric".to_string()));
            }
            Ok(Response::new(Body::from(format!("Valid user {}", user_id))))
        }).unwrap();

        // Test with invalid parameter
        let req = create_test_request(Method::GET, "/users/abc");
        let result = router.handle(req).await;
        assert!(matches!(result, Err(Error::Internal(_))));

        // Test with valid parameter
        let req = create_test_request(Method::GET, "/users/123");
        let resp = router.handle(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        assert_eq!(read_response_body(resp).await, "Valid user 123");
    }
} 