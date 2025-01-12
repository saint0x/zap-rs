use super::*;
use tokio::test;

#[test]
async fn test_path_parameters() {
    let router = JsRouter::new();
    
    // Add a route with path parameters
    router.add_route(
        "GET".to_string(),
        "/users/:id/posts/:postId".to_string(),
        create_test_handler(),
    ).await.unwrap();
    
    // Test valid path
    let request = JsRequest {
        method: "GET".to_string(),
        uri: "/users/123/posts/456".to_string(),
        headers: HashMap::new(),
        body: None,
        params: HashMap::new(),
    };
    
    let response = router.handle(request).await.unwrap();
    assert_eq!(response.status, 200);
    
    let body: serde_json::Value = serde_json::from_str(&response.body.unwrap()).unwrap();
    assert_eq!(body["params"]["id"], "123");
    assert_eq!(body["params"]["postId"], "456");
    
    // Test invalid path
    let request = JsRequest {
        method: "GET".to_string(),
        uri: "/users/123/invalid".to_string(),
        headers: HashMap::new(),
        body: None,
        params: HashMap::new(),
    };
    
    let error = router.handle(request).await.unwrap_err();
    assert!(matches!(error.kind, ErrorKind::NotFound));
}

#[test]
async fn test_middleware_order() {
    let router = JsRouter::new();
    let order = Arc::new(Mutex::new(Vec::new()));
    
    // Add middleware
    let order_clone = Arc::clone(&order);
    router.add_middleware(create_test_middleware("first", move || {
        order_clone.lock().await.push("first:start".to_string());
        Some(Box::new(move || {
            order_clone.lock().blocking_lock().push("first:end".to_string());
        }))
    })).await.unwrap();
    
    let order_clone = Arc::clone(&order);
    router.add_middleware(create_test_middleware("second", move || {
        order_clone.lock().await.push("second:start".to_string());
        Some(Box::new(move || {
            order_clone.lock().blocking_lock().push("second:end".to_string());
        }))
    })).await.unwrap();
    
    // Add test route
    router.add_route(
        "GET".to_string(),
        "/test".to_string(),
        create_test_handler(),
    ).await.unwrap();
    
    // Make request
    let request = JsRequest {
        method: "GET".to_string(),
        uri: "/test".to_string(),
        headers: HashMap::new(),
        body: None,
        params: HashMap::new(),
    };
    
    let _ = router.handle(request).await.unwrap();
    
    // Verify order
    let order = order.lock().await;
    assert_eq!(*order, vec![
        "first:start",
        "second:start",
        "second:end",
        "first:end",
    ]);
}

#[test]
async fn test_validation() {
    let router = JsRouter::new();
    
    // Add validation middleware
    router.add_middleware(create_validation_middleware(vec![
        ValidationRule::new("email", "email"),
        ValidationRule::new("age", "number").param("minimum", json!(18)),
    ])).await.unwrap();
    
    // Add test route
    router.add_route(
        "POST".to_string(),
        "/users".to_string(),
        create_test_handler(),
    ).await.unwrap();
    
    // Test invalid request
    let request = JsRequest {
        method: "POST".to_string(),
        uri: "/users".to_string(),
        headers: HashMap::new(),
        body: Some(r#"{"email": "invalid", "age": 16}"#.to_string()),
        params: HashMap::new(),
    };
    
    let error = router.handle(request).await.unwrap_err();
    assert!(matches!(error.kind, ErrorKind::ValidationError));
    assert!(error.details.is_some());
    let details = error.details.unwrap();
    assert_eq!(details.len(), 2);
    
    // Test valid request
    let request = JsRequest {
        method: "POST".to_string(),
        uri: "/users".to_string(),
        headers: HashMap::new(),
        body: Some(r#"{"email": "test@example.com", "age": 20}"#.to_string()),
        params: HashMap::new(),
    };
    
    let response = router.handle(request).await.unwrap();
    assert_eq!(response.status, 200);
}

// Helper functions
fn create_test_handler() -> ThreadsafeFunction<JsRequest> {
    // Implementation depends on your test setup
    unimplemented!()
}

fn create_test_middleware(
    name: &'static str,
    on_start: impl Fn() -> Option<Box<dyn Fn() + Send + Sync>> + Send + Sync + 'static,
) -> Middleware {
    Box::new(move |req: JsRequest, next: Next| {
        let cleanup = on_start();
        Box::pin(async move {
            let result = next(req).await;
            if let Some(cleanup) = cleanup {
                cleanup();
            }
            result
        })
    })
}

fn create_validation_middleware(rules: Vec<ValidationRule>) -> Middleware {
    Box::new(move |req: JsRequest, next: Next| {
        let rules = rules.clone();
        Box::pin(async move {
            if let Some(body) = &req.body {
                let data: serde_json::Value = serde_json::from_str(body)?;
                
                let mut errors = Vec::new();
                for rule in &rules {
                    if let Some(value) = data.get(&rule.field) {
                        match rule.rule_type.as_str() {
                            "email" => {
                                if !value.is_string() || !value.as_str().unwrap().contains('@') {
                                    errors.push(ValidationErrorDetail {
                                        field: rule.field.clone(),
                                        message: "Invalid email format".to_string(),
                                        code: "invalid_email".to_string(),
                                    });
                                }
                            }
                            "number" => {
                                if let Some(min) = rule.params.get("minimum") {
                                    if !value.is_number() || value.as_f64().unwrap() < min.as_f64().unwrap() {
                                        errors.push(ValidationErrorDetail {
                                            field: rule.field.clone(),
                                            message: format!("Must be at least {}", min),
                                            code: "min_value".to_string(),
                                        });
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                }
                
                if !errors.is_empty() {
                    return Err(ZapError::validation("Validation failed".to_string(), errors));
                }
            }
            
            next(req).await
        })
    })
} 