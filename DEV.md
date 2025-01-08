# Development Guide: Core Router to NAPI Implementation

## Overview

This document outlines the process of converting our core Rust router implementation in `/napi-rs` to a complete Node.js native addon using NAPI-RS.

## Implementation Phases

### Phase 1: NAPI-RS Setup and Configuration

1. **Project Structure Updates**
```bash
/napi-rs
  ├── Cargo.toml      # Add napi-rs dependencies
  ├── build.rs        # NAPI build configuration
  ├── index.js        # JS entry point
  └── src/
      ├── lib.rs      # NAPI bindings
      └── ...         # Existing router implementation
```

2. **Required Dependencies**
```toml
[dependencies]
napi = { version = "2.12.0", features = ["async"] }
napi-derive = "2.12.0"
tokio = { version = "1.0", features = ["full"] }
```

3. **Build Configuration**
```rust
// build.rs
fn main() {
    napi_build::setup();
}
```

### Phase 2: Type System Bridge

1. **JavaScript Type Mappings**
```rust
#[napi]
pub struct JsRouter(Router);

#[napi]
pub struct JsRequest {
    method: String,
    url: String,
    headers: HashMap<String, String>,
    body: Option<Vec<u8>>,
}

#[napi]
pub struct JsResponse {
    status: u16,
    headers: HashMap<String, String>,
    body: Option<Vec<u8>>,
}
```

2. **Type Conversions**
```rust
impl JsRouter {
    fn into_native(self) -> Router {
        self.0
    }
}

impl JsRequest {
    async fn into_hyper_request(self) -> Request<Body> {
        // Convert JsRequest to hyper::Request
    }
}

impl JsResponse {
    fn from_hyper_response(resp: Response<Body>) -> Self {
        // Convert hyper::Response to JsResponse
    }
}
```

### Phase 3: Core Router Adaptation

1. **Async Handler Bridging**
```rust
#[napi]
impl JsRouter {
    #[napi(constructor)]
    pub fn new() -> Self {
        JsRouter(Router::new())
    }

    #[napi]
    pub async fn handle(&self, req: JsRequest) -> Result<JsResponse> {
        let hyper_req = req.into_hyper_request().await?;
        let hyper_resp = self.0.handle(hyper_req).await?;
        Ok(JsResponse::from_hyper_response(hyper_resp))
    }
}
```

2. **Route Registration**
```rust
#[napi]
impl JsRouter {
    #[napi]
    pub fn get(&mut self, path: String, handler: JsFunction) -> Result<()> {
        self.0.get(&path, move |req| {
            // Convert handler to async Rust function
            async move {
                let js_req = JsRequest::from_hyper_request(req);
                let js_resp = handler.call(js_req).await?;
                js_resp.into_hyper_response().await
            }
        })
    }
}
```

### Phase 4: Middleware and Hooks Integration

1. **Middleware System**
```rust
#[napi]
pub struct JsMiddleware(Arc<MiddlewareChain>);

#[napi]
impl JsRouter {
    #[napi]
    pub fn use_middleware(&mut self, middleware: JsFunction) -> Result<()> {
        // Convert JS middleware to Rust middleware chain
    }
}
```

2. **Hook System**
```rust
#[napi]
pub struct JsHooks(Arc<Hooks>);

#[napi]
impl JsRouter {
    #[napi]
    pub fn use_hooks(&mut self, hooks: JsHooks) -> Result<()> {
        self.0.with_hooks(hooks.0);
        Ok(())
    }
}
```

### Phase 5: Error Handling and Type Safety

1. **Error Mapping**
```rust
#[napi]
pub enum JsRouterError {
    RouteNotFound,
    Internal,
    Middleware,
    Handler,
}

impl From<Error> for JsRouterError {
    fn from(err: Error) -> Self {
        match err {
            Error::RouteNotFound(_) => JsRouterError::RouteNotFound,
            // ... other mappings
        }
    }
}
```

2. **Type Definitions Generation**
```typescript
// index.d.ts
export class Router {
    constructor();
    get(path: string, handler: (req: Request) => Promise<Response>): void;
    post(path: string, handler: (req: Request) => Promise<Response>): void;
    handle(req: Request): Promise<Response>;
    useMiddleware(middleware: Middleware): void;
    useHooks(hooks: Hooks): void;
}
```

## Testing Strategy

1. **Unit Tests**
```rust
#[napi]
#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn test_route_handling() {
        let router = JsRouter::new();
        // Test route registration and handling
    }
}
```

2. **Integration Tests**
```javascript
// test/integration.js
const { Router } = require('./');

describe('Router Integration', () => {
    it('handles routes correctly', async () => {
        const router = new Router();
        // Test full request-response cycle
    });
});
```

## Performance Considerations

1. **Memory Management**
- Use `ThreadsafeFunction` for JS callbacks
- Implement proper cleanup in destructors
- Minimize copying between JS and Rust

2. **Threading Model**
```rust
#[napi]
impl JsRouter {
    #[napi(ts_args_type = "handler: (req: Request) => Promise<Response>")]
    pub fn get(&mut self, path: String, handler: JsFunction) -> Result<()> {
        let tsfn = handler.create_threadsafe_function(0, |ctx| {
            // Handle thread-safe callback to JS
            Ok(vec![ctx.value])
        })?;
        // Store thread-safe function
    }
}
```

## Packaging and Distribution

1. **Package.json Configuration**
```json
{
  "name": "@zap/router",
  "version": "1.0.0",
  "napi": {
    "name": "router",
    "triples": {
      "defaults": true,
      "additional": [
        "x86_64-apple-darwin",
        "x86_64-pc-windows-msvc",
        "x86_64-unknown-linux-gnu"
      ]
    }
  }
}
```

2. **Publishing Workflow**
```yaml
name: Publish
on:
  push:
    tags:
      - 'v*'
jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    steps:
      - uses: actions/checkout@v2
      - name: Build
        run: npm run build
      - name: Publish
        run: npm publish
```

## Migration Path

1. **Gradual Migration Strategy**
- Start with core routing functionality
- Add middleware support
- Implement hook system
- Add advanced features

2. **Compatibility Layer**
```typescript
// compatibility.ts
export function createLegacyRouter(): Router {
    const router = new Router();
    // Add legacy compatibility methods
    return router;
}
```

## Documentation Updates

1. **API Documentation**
- Update TypeScript definitions
- Add JSDoc comments
- Create usage examples

2. **Performance Guidelines**
- Document best practices
- Provide memory usage guidelines
- Include threading considerations 