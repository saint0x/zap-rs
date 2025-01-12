use napi_derive::napi;
use napi::{
    JsFunction,
    Result,
    Env,
};
use std::collections::HashMap;
use crate::types::{JsRequest, JsResponse, ResponseBody};

#[napi]
pub struct Router {
    routes: HashMap<String, JsFunction>,
}

#[napi]
impl Router {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            routes: HashMap::new(),
        }
    }

    #[napi]
    pub fn handle(&self, env: Env, request: JsRequest) -> Result<JsResponse> {
        let route_key = format!("{} {}", request.method, request.uri);
        
        if let Some(handler) = self.routes.get(&route_key) {
            // Convert request to JsObject
            let request_obj = request.to_object(env)?;
            
            // Call the handler
            let result = handler.call(None, &[request_obj])?;
            
            // Convert to JsResponse
            if result.is_promise()? {
                // Return the Promise directly
                Ok(JsResponse {
                    status: 200,
                    headers: HashMap::new(),
                    body: Some(ResponseBody {
                        type_: "Promise".to_string(),
                        content: "Async response".to_string(),
                    }),
                })
            } else {
                // Convert sync response
                JsResponse::from_object(result.coerce_to_object()?)
            }
        } else {
            Ok(JsResponse {
                status: 404,
                headers: {
                    let mut map = HashMap::new();
                    map.insert("content-type".to_string(), "application/json".to_string());
                    map
                },
                body: Some(ResponseBody {
                    type_: "Text".to_string(),
                    content: "Route not found".to_string(),
                }),
            })
        }
    }

    #[napi]
    pub fn register(&mut self, method: String, path: String, handler: JsFunction) -> Result<()> {
        let route_key = format!("{} {}", method, path);
        self.routes.insert(route_key, handler);
        Ok(())
    }

    #[napi]
    pub fn get(&mut self, path: String, handler: JsFunction) -> Result<()> {
        self.register("GET".to_string(), path, handler)
    }

    #[napi]
    pub fn post(&mut self, path: String, handler: JsFunction) -> Result<()> {
        self.register("POST".to_string(), path, handler)
    }

    #[napi]
    pub fn put(&mut self, path: String, handler: JsFunction) -> Result<()> {
        self.register("PUT".to_string(), path, handler)
    }

    #[napi]
    pub fn delete(&mut self, path: String, handler: JsFunction) -> Result<()> {
        self.register("DELETE".to_string(), path, handler)
    }
} 