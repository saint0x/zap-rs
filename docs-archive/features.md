# Features

This document outlines all the features and capabilities of zap-rs.

## Core Features

### Routing System

#### Path Parameters
- Dynamic route segments with `:param` syntax
- Type-safe parameter extraction
- Automatic parameter parsing and validation
```typescript
@zap.get('/users/:id/posts/:postId')
async getPost(@zap.param('id') userId: string) {}
```

#### Pattern Matching
- Exact path matching
- Parameter-based matching
- Nested route handling
```typescript
@zap.controller('/api/v1')
class ApiController {
  @zap.get('/users/:id')  // Matches /api/v1/users/123
  @zap.get('/posts/*')    // Matches any path under posts
}
```

### Middleware System

#### Global Middleware
- Controller-level middleware application
- Shared authentication/authorization
```typescript
@zap.controller('/api', [authenticate, logging])
class ApiController {}
```

#### Route-Specific Middleware
- Per-route middleware
- Multiple middleware chains
```typescript
@zap.use(authenticate)
@zap.use(validateSession)
@zap.get('/protected')
async getData() {}
```

#### Built-in Middleware Types
- Authentication middleware
- Validation middleware
- Guard middleware
- Response transformation middleware

### Request Handling

#### Parameter Decorators
- `@zap.param()` - Route parameters
- `@zap.query()` - Query string parameters
- `@zap.body()` - Request body
- `@zap.header()` - HTTP headers
```typescript
async handler(
  @zap.param('id') id: string,
  @zap.query('sort') sort: string,
  @zap.body() data: any,
  @zap.header('x-api-key') apiKey: string
) {}
```

#### Request Validation
- Schema-based validation
- Custom validation functions
- Type-safe request bodies
```typescript
@zap.validate(userSchema)
@zap.post('/users')
async createUser(@zap.body() user: UserDto) {}
```

### Response Handling

#### Status Codes
- Custom status code setting
- Default status code handling
```typescript
@zap.status(201)
@zap.post('/users')
async createUser() {}
```

#### Response Transformation
- Response data transformation
- Header manipulation
- Error formatting
```typescript
@zap.response(addTimestamp)
@zap.get('/data')
async getData() {}
```

#### Error Handling
- Automatic error catching
- Error status code mapping
- Custom error responses
```typescript
// Automatically handled errors
throw new Error('Not Found') // -> 404 response
throw new Error('Unauthorized') // -> 401 response
```

### Type Safety

#### TypeScript Integration
- Full TypeScript support
- Decorator type inference
- Request/Response type safety
```typescript
interface UserDto {
  username: string;
  email: string;
}

@zap.post('/users')
async createUser(@zap.body() user: UserDto) {
  // user is fully typed
}
```

#### Runtime Type Checking
- Schema validation
- Runtime type enforcement
- Custom type validators

### Performance Features

#### Rust Core
- High-performance routing engine
- Zero-copy operations where possible
- Efficient memory usage

#### Request Processing
- Fast path parameter extraction
- Efficient header processing
- Optimized body parsing

### Framework Integration

#### Express.js Integration
- Drop-in middleware
- Request/Response compatibility
- Error handling integration
```typescript
const app = express();
app.use(zap.handler());
```

#### Standalone Usage
- Can be used without Express
- Direct HTTP server integration
- Custom server framework support

### Development Features

#### Hot Reloading
- Development mode with hot reload
- Fast refresh support
- State preservation

#### Debugging
- Detailed error messages
- Stack trace preservation
- Development logging

## Additional Features

### Security
- CORS support
- XSS protection
- Request sanitization

### Extensibility
- Custom decorator creation
- Middleware composition
- Plugin system

### Documentation
- TypeScript definitions
- JSDoc comments
- Comprehensive guides

## Platform Support

### Operating Systems
- macOS (x64, arm64)
- Linux (x64, arm64)
- Windows (x64, arm64)

### Runtime Requirements
- Node.js 14+
- TypeScript 4.5+
- No additional runtime dependencies

## Best Practices Support

### Code Organization
- Controller-based architecture
- Middleware separation
- Type definition patterns

### Error Handling
- Standardized error responses
- Error type hierarchy
- Error transformation

### Performance Optimization
- Efficient routing
- Memory management
- Request processing 