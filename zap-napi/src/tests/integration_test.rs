use super::*;
use tokio::test;
use napi::{JsFunction, JsObject, Env};
use std::collections::HashMap;
use serde_json;
use napi::bindgen_prelude::*;
use crate::{Router, Hooks, RouteConfig};

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

#[test]
fn test_router_with_params() {
    let hooks = Hooks::new();
    let router = Router::new(&hooks);

    // Register routes with parameters
    let user_id = router.register("GET".into(), "/users/:id".into(), None).unwrap();
    let post_id = router.register("GET".into(), "/posts/:id/comments/:commentId".into(), None).unwrap();
    let wildcard = router.register("GET".into(), "/files/*".into(), None).unwrap();

    // Test simple parameter matching
    let (handler_id, params, _) = router.get_handler_info("GET".into(), "/users/123".into())
        .unwrap()
        .expect("Should match user route");
    assert_eq!(handler_id, user_id);
    assert_eq!(params.params.get("id").unwrap(), "123");

    // Test multiple parameters
    let (handler_id, params, _) = router.get_handler_info("GET".into(), "/posts/456/comments/789".into())
        .unwrap()
        .expect("Should match post route");
    assert_eq!(handler_id, post_id);
    assert_eq!(params.params.get("id").unwrap(), "456");
    assert_eq!(params.params.get("commentId").unwrap(), "789");

    // Test wildcard matching
    let (handler_id, params, _) = router.get_handler_info("GET".into(), "/files/path/to/file.txt".into())
        .unwrap()
        .expect("Should match wildcard route");
    assert_eq!(handler_id, wildcard);
    assert_eq!(params.params.get("*").unwrap(), "path/to/file.txt");
}

#[test]
fn test_middleware_and_guards() -> Result<()> {
    let env = &mut unsafe { napi::Env::from_raw(std::ptr::null_mut()) };
    let hooks = Hooks::new();
    let router = Router::new(&hooks);

    // Create dummy middleware functions
    let auth_middleware = env.create_function_from_closure("auth", |_ctx| Ok(()))?;
    let logging_middleware = env.create_function_from_closure("logging", |_ctx| Ok(()))?;
    let admin_guard = env.create_function_from_closure("admin", |_ctx| Ok(()))?;

    // Register middleware
    let auth_id = router.register_middleware(*env, auth_middleware)?;
    let logging_id = router.register_middleware(*env, logging_middleware)?;
    let admin_id = router.register_middleware(*env, admin_guard)?;

    // Create route with middleware and guards
    let config = RouteConfig {
        middleware: Some(vec![auth_id, logging_id]),
        guards: Some(vec![admin_id]),
        validation: None,
        transform: None,
    };

    let handler_id = router.register("GET".into(), "/admin/dashboard".into(), Some(config))?;

    // Verify middleware chain
    let middleware_chain = router.get_middleware_chain(handler_id)
        .expect("Should have middleware");
    assert_eq!(middleware_chain.len(), 2);

    // Verify guards
    let guards = router.get_guards(handler_id)
        .expect("Should have guards");
    assert_eq!(guards.len(), 1);

    Ok(())
}

#[test]
fn test_validation_and_transform() -> Result<()> {
    let env = &mut unsafe { napi::Env::from_raw(std::ptr::null_mut()) };
    let hooks = Hooks::new();
    let router = Router::new(&hooks);

    // Create dummy validation and transform functions
    let validation = env.create_function_from_closure("validate", |_ctx| Ok(()))?;
    let transform = env.create_function_from_closure("transform", |_ctx| Ok(()))?;

    // Create route with validation and transform
    let config = RouteConfig {
        middleware: None,
        guards: None,
        validation: Some(validation),
        transform: Some(transform),
    };

    let handler_id = router.register("POST".into(), "/users".into(), Some(config))?;

    // Verify validation
    let validation = router.get_validation(handler_id)
        .expect("Should have validation");
    assert!(validation.is_function());

    // Verify transform
    let transform = router.get_transform(handler_id)
        .expect("Should have transform");
    assert!(transform.is_function());

    Ok(())
}

// Helper functions
fn create_test_handler() -> JsFunction {
    let env = unsafe { napi::Env::from_raw(napi::sys::napi_get_current_env()) };
    let js_func = env.create_function(
        "testHandler",
        |ctx| {
            let env = ctx.env;
            let request = ctx.get::<JsObject>(0)?;
            
            let response = JsResponse {
                status: 200,
                headers: HashMap::new(),
                body: Some(serde_json::json!({
                    "type": "Text",
                    "content": "Test Success"
                }).to_string()),
            };
            
            Ok(response.to_object(env)?)
        }
    ).unwrap();
    
    js_func
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