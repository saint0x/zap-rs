use napi_derive::napi;
use napi::bindgen_prelude::*;
use std::collections::HashMap;

#[napi]
pub struct JsStore {
    data: HashMap<String, JsUnknown>,
}

#[napi]
impl JsStore {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            data: HashMap::new(),
        }
    }

    #[napi]
    pub fn get(&self, key: String) -> napi::Result<Option<JsUnknown>> {
        Ok(self.data.get(&key).cloned())
    }

    #[napi]
    pub fn set(&mut self, key: String, value: JsUnknown) -> napi::Result<()> {
        self.data.insert(key, value);
        Ok(())
    }

    #[napi]
    pub fn delete(&mut self, key: String) -> napi::Result<()> {
        self.data.remove(&key);
        Ok(())
    }

    #[napi]
    pub fn clear(&mut self) -> napi::Result<()> {
        self.data.clear();
        Ok(())
    }

    #[napi]
    pub fn has(&self, key: String) -> napi::Result<bool> {
        Ok(self.data.contains_key(&key))
    }

    #[napi]
    pub fn keys(&self) -> napi::Result<Vec<String>> {
        Ok(self.data.keys().cloned().collect())
    }

    #[napi]
    pub fn values(&self) -> napi::Result<Vec<JsUnknown>> {
        Ok(self.data.values().cloned().collect())
    }

    #[napi]
    pub fn entries(&self) -> napi::Result<Vec<(String, JsUnknown)>> {
        Ok(self.data.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
    }

    #[napi]
    pub fn size(&self) -> napi::Result<u32> {
        Ok(self.data.len() as u32)
    }
} 