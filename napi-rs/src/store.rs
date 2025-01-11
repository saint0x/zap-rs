use napi_derive::napi;
use napi::bindgen_prelude::*;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

// Define a wrapper type for JsUnknown to handle cloning
#[derive(Clone)]
struct StoredValue(JsUnknown);

impl From<JsUnknown> for StoredValue {
    fn from(value: JsUnknown) -> Self {
        StoredValue(value)
    }
}

impl From<StoredValue> for JsUnknown {
    fn from(value: StoredValue) -> Self {
        value.0
    }
}

#[napi]
pub struct JsStore {
    data: Arc<RwLock<HashMap<String, StoredValue>>>,
}

#[napi]
impl JsStore {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            data: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    #[napi]
    pub async fn get(&self, key: String) -> napi::Result<Option<JsUnknown>> {
        let store = self.data.read().await;
        Ok(store.get(&key).map(|v| v.clone().into()))
    }

    #[napi]
    pub async fn set(&self, key: String, value: JsUnknown) -> napi::Result<()> {
        let mut store = self.data.write().await;
        store.insert(key, value.into());
        Ok(())
    }

    #[napi]
    pub async fn delete(&self, key: String) -> napi::Result<()> {
        let mut store = self.data.write().await;
        store.remove(&key);
        Ok(())
    }

    #[napi]
    pub async fn clear(&self) -> napi::Result<()> {
        let mut store = self.data.write().await;
        store.clear();
        Ok(())
    }

    #[napi]
    pub async fn has(&self, key: String) -> napi::Result<bool> {
        let store = self.data.read().await;
        Ok(store.contains_key(&key))
    }

    #[napi]
    pub async fn keys(&self) -> napi::Result<Vec<String>> {
        let store = self.data.read().await;
        Ok(store.keys().cloned().collect())
    }

    #[napi]
    pub async fn values(&self) -> napi::Result<Vec<JsUnknown>> {
        let store = self.data.read().await;
        Ok(store.values().map(|v| v.clone().into()).collect())
    }

    #[napi]
    pub async fn entries(&self) -> napi::Result<Vec<(String, JsUnknown)>> {
        let store = self.data.read().await;
        Ok(store.iter().map(|(k, v)| (k.clone(), v.clone().into())).collect())
    }

    #[napi]
    pub async fn size(&self) -> napi::Result<u32> {
        let store = self.data.read().await;
        Ok(store.len() as u32)
    }
} 