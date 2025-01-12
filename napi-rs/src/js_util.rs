use napi::{
    bindgen_prelude::*,
    JsFunction,
    JsUnknown,
    Env,
    Result as NapiResult,
    NapiValue,
    sys,
};

pub struct JsFunctionHandle {
    function: JsFunction,
    env: sys::napi_env,
}

impl JsFunctionHandle {
    pub fn new(env: Env, func: JsFunction) -> NapiResult<Self> {
        Ok(JsFunctionHandle {
            function: func,
            env: env.raw(),
        })
    }

    pub fn env(&self) -> sys::napi_env {
        self.env
    }

    pub fn call(&self, args: &[JsUnknown]) -> NapiResult<JsUnknown> {
        self.function.call(None, args)
    }
}

impl Clone for JsFunctionHandle {
    fn clone(&self) -> Self {
        Self {
            function: self.function.clone(),
            env: self.env,
        }
    }
}

#[derive(Clone)]
pub struct SafeJsFunction {
    function: Option<JsFunctionHandle>,
}

impl SafeJsFunction {
    pub fn new() -> Self {
        SafeJsFunction {
            function: None,
        }
    }

    pub fn set(&mut self, handle: JsFunctionHandle) {
        self.function = Some(handle);
    }

    pub fn get(&self) -> Option<&JsFunctionHandle> {
        self.function.as_ref()
    }

    pub fn clear(&mut self) {
        self.function = None;
    }
}

impl Default for SafeJsFunction {
    fn default() -> Self {
        Self::new()
    }
} 