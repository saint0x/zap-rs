use napi_derive::napi;
use dashmap::DashMap;
use std::sync::Arc;
use napi::JsUnknown;

pub struct Store {
    data: Arc<DashMap<String, JsUnknown>>,
}

impl Store {
    pub fn new() -> Self {
        Self {
            data: Arc::new(DashMap::new()),
        }
    }

    pub fn set(&self, key: String, value: JsUnknown) {
        self.data.insert(key, value);
    }

    pub fn get(&self, key: &str) -> Option<JsUnknown> {
        self.data.get(key).map(|v| v.value().clone())
    }

    pub fn delete(&self, key: &str) {
        self.data.remove(key);
    }

    pub fn clear(&self) {
        self.data.clear();
    }
}

#[napi]
pub struct JsStore(Arc<Store>);

#[napi]
impl JsStore {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self(Arc::new(Store::new()))
    }

    #[napi]
    pub fn set(&self, key: String, value: JsUnknown) -> napi::Result<()> {
        self.0.set(key, value);
        Ok(())
    }

    #[napi]
    pub fn get(&self, key: String) -> napi::Result<Option<JsUnknown>> {
        Ok(self.0.get(&key))
    }

    #[napi]
    pub fn delete(&self, key: String) -> napi::Result<()> {
        self.0.delete(&key);
        Ok(())
    }

    #[napi]
    pub fn clear(&self) -> napi::Result<()> {
        self.0.clear();
        Ok(())
    }
} 