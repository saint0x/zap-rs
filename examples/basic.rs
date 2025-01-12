use napi_derive::napi;
use napi::bindgen_prelude::*;
use std::collections::HashMap;

#[napi]
fn main() -> napi::Result<()> {
    // Store example
    crate::set("key1".to_string(), "value1".into())?;
    let value = crate::get("key1".to_string())?;
    println!("Value: {:?}", value);

    // Router example
    crate::register_route("/hello".to_string(), |ctx| {
        println!("Request received: {:?}", ctx);
        Ok(())
    })?;

    // Create a sample request
    let mut headers = HashMap::new();
    headers.insert("content-type".to_string(), "application/json".to_string());
    
    let request = serde_json::json!({
        "method": "GET",
        "path": "/hello",
        "headers": headers,
        "body": "Hello World"
    });

    // Handle request
    crate::handle_request("/hello".to_string(), request.into())?;

    // Hooks example
    crate::register_before("/hello".to_string(), |ctx| {
        println!("Before hook: {:?}", ctx);
        Ok(())
    })?;

    crate::register_after("/hello".to_string(), |ctx| {
        println!("After hook: {:?}", ctx);
        Ok(())
    })?;

    Ok(())
} 