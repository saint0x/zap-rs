use napi_derive::napi;
use napi::{Result, Env, JsObject, JsString};
use std::collections::HashMap;

#[napi]
pub struct JsRequest {
    pub method: String,
    pub uri: String,
    pub params: HashMap<String, String>,
    pub query: HashMap<String, String>,
    pub body: Option<String>,
}

impl JsRequest {
    pub fn from_object(obj: JsObject) -> Result<Self> {
        let method = obj.get_named_property::<String>("method")?;
        let uri = obj.get_named_property::<String>("uri")?;
        
        let params_obj: JsObject = obj.get_named_property("params")?;
        let mut params = HashMap::new();
        let param_keys = params_obj.get_property_names()?;
        for i in 0..param_keys.get_array_length()? {
            let key = param_keys.get_element::<JsString>(i)?;
            let key_str = key.into_utf8()?.into_owned()?;
            if let Ok(value) = params_obj.get_named_property::<String>(&key_str) {
                params.insert(key_str, value);
            }
        }

        let query_obj: JsObject = obj.get_named_property("query")?;
        let mut query = HashMap::new();
        let query_keys = query_obj.get_property_names()?;
        for i in 0..query_keys.get_array_length()? {
            let key = query_keys.get_element::<JsString>(i)?;
            let key_str = key.into_utf8()?.into_owned()?;
            if let Ok(value) = query_obj.get_named_property::<String>(&key_str) {
                query.insert(key_str, value);
            }
        }

        let body = obj.get_named_property::<Option<String>>("body")?;

        Ok(JsRequest {
            method,
            uri,
            params,
            query,
            body,
        })
    }

    pub fn to_object(&self, env: Env) -> Result<JsObject> {
        let mut obj = env.create_object()?;

        obj.set_named_property("method", &self.method)?;
        obj.set_named_property("uri", &self.uri)?;

        let mut params_obj = env.create_object()?;
        for (key, value) in &self.params {
            params_obj.set_named_property(key, value)?;
        }
        obj.set_named_property("params", params_obj)?;

        let mut query_obj = env.create_object()?;
        for (key, value) in &self.query {
            query_obj.set_named_property(key, value)?;
        }
        obj.set_named_property("query", query_obj)?;

        if let Some(body) = &self.body {
            obj.set_named_property("body", body)?;
        }

        Ok(obj)
    }
}

#[napi]
pub struct JsResponse {
    pub status: i32,
    pub body: Option<String>,
}

impl JsResponse {
    pub fn to_object(&self, env: Env) -> Result<JsObject> {
        let mut obj = env.create_object()?;
        obj.set_named_property("status", self.status)?;
        if let Some(body) = &self.body {
            obj.set_named_property("body", body)?;
        }
        Ok(obj)
    }

    pub fn from_object(obj: JsObject) -> Result<Self> {
        let status = obj.get_named_property::<i32>("status")?;
        let body = obj.get_named_property::<Option<String>>("body")?;
        Ok(JsResponse { status, body })
    }
}

#[napi]
pub struct ZapError {
    pub code: String,
    pub details: Option<String>,
}

impl ZapError {
    pub fn to_object(&self, env: Env) -> Result<JsObject> {
        let mut obj = env.create_object()?;
        obj.set_named_property("code", &self.code)?;
        if let Some(details) = &self.details {
            obj.set_named_property("details", details)?;
        }
        Ok(obj)
    }

    pub fn from_object(obj: JsObject) -> Result<Self> {
        let code = obj.get_named_property::<String>("code")?;
        let details = obj.get_named_property::<Option<String>>("details")?;
        Ok(ZapError { code, details })
    }
} 