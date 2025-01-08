
# DEVELOPMENT.md

## Table of Contents
1. [Core Rust Router Development Plan](#core-rust-router-development-plan)
2. [NAPI Integration](#napi-integration)
3. [TypeScript Logic](#typescript-logic)

---

## Core Rust Router Development Plan

### 1. Initial Setup

**Dependencies:**
- `hyper` (for HTTP server)
- `tokio` (for asynchronous runtime)
- `serde` (for JSON parsing)
- `thiserror` (for error handling)
- `anyhow` (for simplified error handling)

**Steps:**
1. **Initialize Rust project**:
   - `cargo new rust-router`
   - Add dependencies in `Cargo.toml`:
     ```toml
     [dependencies]
     hyper = "0.14"
     tokio = { version = "1", features = ["full"] }
     serde = { version = "1.0", features = ["derive"] }
     serde_json = "1.0"
     thiserror = "1.0"
     anyhow = "1.0"
     ```

2. **Create HTTP server using `hyper`**:
   - Set up the basic HTTP server using `hyper`.
   - Ensure the server is asynchronous and capable of handling requests efficiently.

3. **Define routing system**:
   - Implement a **Trie-based routing** mechanism to handle path matching in O(1).
   - Ensure memory efficiency using zero-copy techniques for request handling.
   - Add routing for path parameters and query string extraction.

### 2. Core Features for the Router

**Zero-Copy Operations**:
- Implement **zero-copy** techniques for the HTTP body, headers, and query parameters using `hyper` and `tokio` buffers.
- Ensure **memory safety** and low-latency processing by avoiding unnecessary allocations.

**Trie-Based Routing**:
- Implement a **Trie-based route matcher** to allow O(1) lookups for path matching.
- Design the route matching system to handle parameterized routes efficiently (e.g., `/user/:id`).
  
**Async Middleware Chains**:
- Build an **asynchronous middleware system** that can handle dynamic and reusable functionality such as logging, authentication, and validation.
- Middleware hooks should be **before** and **after** route matching, ensuring extensibility.

**Hooks to Implement**:
1. **Request Pre-processing Hook** (Before Route Matching):
   - Authentication, logging, request normalization.
2. **Route Matching Hook** (Before Handling Request):
   - Dynamic route selection, IP-based routing, or rate-limiting logic.
3. **Parameter Parsing Hook**:
   - Parsing and validating parameters (e.g., path parameters and query parameters).
4. **Middleware Hook**:
   - Before and after route handling to allow middleware extensions (e.g., logging, authorization checks).
5. **Error Handling Hook**:
   - Custom error responses and logging.
6. **Response Modification Hook**:
   - Response transformation before sending it back to the client (e.g., adding headers or transforming the response body).

**Efficient Parameter Extraction**:
- Implement a system that efficiently extracts path parameters, query parameters, and handles routing logic with low overhead.

**Optimized Body Parsing**:
- Ensure that body parsing for JSON, form data, and other content types is efficient and zero-copy.

### 3. Later Phase Features
In the later part of the core Rust router, we will include the following:
- **Rate Limiting Hook**: Implement rate limiting based on IP or API keys.
- **Caching Layer**: Implement a lightweight caching layer for frequently accessed routes.
- **Telemetry and Monitoring**: Integrate metrics collection for performance monitoring (this will come later).

---

## NAPI Integration

### 1. Initialize NAPI bindings
- **Goal**: Bind the Rust core router to TypeScript via NAPI (Node API) bindings.
  
**Steps**:
1. Add the `napi` crate to your `Cargo.toml`:
   ```toml
   [dependencies]
   napi = "2.0"
   ```
2. Create the NAPI bindings to expose Rust functionalities to TypeScript.
   - Use `napi` functions to expose the router's core functionality like route handling and middleware chaining.
   - Expose the `hyper` server and related functionalities in a way that can be called directly from TypeScript.

### 2. Expose Rust Router API
- Define the main API functions and types that will be accessible in TypeScript. This should include:
   - `start_server()`: Starts the HTTP server.
   - `add_route()`: Adds a new route to the router.
   - `use_middleware()`: Registers middleware functions.
   - `handle_request()`: Handles individual HTTP requests.

### 3. Testing and Validation
- Ensure that the NAPI bindings are **well-tested** with TypeScript and Rust code.
- Write unit tests for the router’s core logic to ensure correctness and performance.

---

## TypeScript Logic

### 1. Basic Setup
- Initialize a TypeScript project and install the required packages:
  - `typescript`: For TypeScript support.
  - `@types/node`: For Node.js typings.
  - `napi`: For interacting with the Rust bindings.
  - `ts-node`: For running TypeScript files directly.

  Install dependencies:
  ```bash
  npm init -y
  npm install typescript @types/node napi ts-node
  ```

### 2. Implement Router Logic in TypeScript
- Use the exposed Rust core router logic to implement TypeScript-level routing and middleware functionalities.
- Implement custom **TypeScript middleware** to integrate with the Rust router:
  - Authentication middleware.
  - Logging middleware.
  - Custom response formatting.

### 3. Example TypeScript Code
```typescript
import { start_server, add_route, use_middleware } from 'rust-router';

use_middleware((req, res) => {
  // Log request
  console.log(`Request: ${req.url}`);
  next();
});

add_route('/users/:id', (req, res) => {
  const userId = req.params.id;
  res.send(`User ID: ${userId}`);
});

start_server();
```

### 4. Handling TypeScript to Rust Communication
- Utilize the NAPI bindings to ensure **efficient communication** between TypeScript and Rust, ensuring minimal overhead while passing data back and forth.

---

### Conclusion

This document outlines the development process for building a **high-performance Rust API router** with an eventual integration into **TypeScript via NAPI**. The focus is on building the **core Rust router** first, optimizing it for performance with features like zero-copy operations, trie-based routing, and hooks. Once the Rust core is complete, we’ll integrate NAPI and implement TypeScript logic to expose the core router’s functionality and allow developers to extend and use it with ease.

