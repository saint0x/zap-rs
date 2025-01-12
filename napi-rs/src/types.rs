use napi_derive::napi;
use napi::{
    JsObject,
    JsString,
    JsNumber,
    Result,
};
use std::collections::HashMap;

#[napi(object)]
#[derive(Clone)]
pub struct JsRequest {
    pub method: String,
    pub uri: String,
    pub headers: HashMap<String, String>,
    #[napi(ts_type = "any")]
    pub body: Option<String>,
    pub params: HashMap<String, String>,
    pub query: HashMap<String, String>,
}

impl JsRequest {
    pub fn to_object<'a>(&self, env: napi::Env) -> Result<JsObject> {
        let mut obj = env.create_object()?;
        
        obj.set_named_property("method", env.create_string(&self.method)?)?;
        obj.set_named_property("uri", env.create_string(&self.uri)?)?;
        
        let mut headers = env.create_object()?;
        for (key, value) in &self.headers {
            headers.set_named_property(key, env.create_string(value)?)?;
        }
        obj.set_named_property("headers", headers)?;
        
        if let Some(body) = &self.body {
            obj.set_named_property("body", env.create_string(body)?)?;
        }
        
        let mut params = env.create_object()?;
        for (key, value) in &self.params {
            params.set_named_property(key, env.create_string(value)?)?;
        }
        obj.set_named_property("params", params)?;
        
        let mut query = env.create_object()?;
        for (key, value) in &self.query {
            query.set_named_property(key, env.create_string(value)?)?;
        }
        obj.set_named_property("query", query)?;
        
        Ok(obj)
    }
}

#[napi(object)]
#[derive(Clone)]
pub struct ResponseBody {
    #[napi(ts_type = "string")]
    pub type_: String,
    pub content: String,
}

#[napi(object)]
#[derive(Clone)]
pub struct JsResponse {
    pub status: i32,
    pub headers: HashMap<String, String>,
    pub body: Option<ResponseBody>,
}

impl JsResponse {
    pub fn from_object(obj: JsObject) -> Result<Self> {
        // Get status
        let status = obj.get_named_property::<JsNumber>("status")?
            .get_int32()?;
        
        // Get headers
        let headers_value = obj.get_named_property::<JsObject>("headers")?;
        let mut headers = HashMap::new();
        let header_keys = headers_value.get_property_names()?;
        for i in 0..header_keys.get_array_length()? {
            let key = header_keys.get_element::<JsString>(i)?
                .into_utf8()?
                .into_owned()?;
            let value = headers_value.get_named_property::<JsString>(&key)?
                .into_utf8()?
                .into_owned()?;
            headers.insert(key, value);
        }
        
        // Get body if it exists
        let body = if let Ok(body_value) = obj.get_named_property::<JsObject>("body") {
            let type_ = body_value.get_named_property::<JsString>("type")?
                .into_utf8()?
                .into_owned()?;
            let content = body_value.get_named_property::<JsString>("content")?
                .into_utf8()?
                .into_owned()?;
            Some(ResponseBody { type_, content })
        } else {
            None
        };
        
        Ok(JsResponse {
            status,
            headers,
            body,
        })
    }
}

#[napi(object)]
#[derive(Clone)]
pub struct ZapError {
    pub code: String,
    #[napi(ts_type = "any")]
    pub details: Option<String>,
}

#[napi(object)]
#[derive(Clone)]
pub struct RequestContext {
    pub id: String,
    pub timestamp: i64,
    #[napi(ts_type = "Record<string, unknown>")]
    pub metadata: HashMap<String, String>,
    #[napi(ts_type = "Map<string, unknown>")]
    pub state: HashMap<String, String>,
}

#[napi(object)]
#[derive(Clone)]
pub struct RouteParams {
    pub path_params: HashMap<String, String>,
    pub query_params: HashMap<String, String>,
} 