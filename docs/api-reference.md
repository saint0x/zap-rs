# API Reference

## Core Concepts

The Zap Router provides a decorator-based API for building type-safe routes with middleware support.

## Decorators

### Controller Decorator

#### @zap.controller(path: string, middleware?: MiddlewareFunction[])
Class decorator that defines the base path and optional middleware for all routes in a controller.

```typescript
@zap.controller('/api', [authMiddleware])
class UserController {
    // Routes will be prefixed with /api
    // All routes will use authMiddleware
}
```

### HTTP Method Decorators

#### @zap.get(path: string)
#### @zap.post(path: string)
#### @zap.put(path: string)
#### @zap.delete(path: string)
#### @zap.patch(path: string)
#### @zap.options(path: string)
#### @zap.head(path: string)

Method decorators for HTTP routes. Support path parameters and pattern matching.

```typescript
@zap.get('/users')
async getUsers() {}

@zap.get('/users/:id')
async getUser(@zap.param('id') id: string) {}

@zap.post('/users')
async createUser(@zap.body() data: any) {}
```

### Parameter Decorators

#### @zap.param(name: string)
Extracts path parameters.

```typescript
@zap.get('/users/:id')
async getUser(@zap.param('id') id: string) {}
```

#### @zap.query(name: string)
Extracts query parameters.

```typescript
@zap.get('/users')
async getUsers(@zap.query('page') page: string) {}
```

#### @zap.body()
Extracts and validates request body.

```typescript
@zap.post('/users')
async createUser(@zap.body() data: any) {}
```

#### @zap.header(name: string)
Extracts request headers.

```typescript
@zap.get('/users')
async getUsers(@zap.header('x-api-key') apiKey: string) {}
```

### Middleware Decorators

#### @zap.use(middleware: MiddlewareFunction)
Applies middleware to a route.

```typescript
@zap.use(authenticate)
@zap.get('/protected')
async getProtectedData() {}
```

#### @zap.validate(validator: MiddlewareFunction)
Validates request data.

```typescript
@zap.validate(userSchema)
@zap.post('/users')
async createUser(@zap.body() data: any) {}
```

### Response Decorators

#### @zap.response(transform: (data: any) => any)
Transforms the response data.

```typescript
@zap.response(addTimestamp)
@zap.get('/users')
async getUsers() {}
```

#### @zap.status(code: number)
Sets the response status code.

```typescript
@zap.status(201)
@zap.post('/users')
async createUser() {}
```

## Types

### Request
```typescript
type Request = {
  method: HttpMethod;
  url: string;
  headers: [string, string][];
  body?: string;
  query: Record<string, string>;
  params: Record<string, string>;
};
```

### Response
```typescript
type Response = {
  status: number;
  body: string;
  headers: [string, string][];
};
```

### MiddlewareFunction
```typescript
type MiddlewareFunction = (request: Request) => Promise<boolean>;
```

### RouteMetadata
```typescript
type RouteMetadata = {
  path: string;
  method: HttpMethod;
  handler: Function;
  params?: ParamMetadata[];
  middleware?: MiddlewareFunction[];
};
```

## Error Handling

The router automatically handles errors with appropriate status codes:

- 404 Not Found: Route doesn't exist
- 400 Bad Request: Invalid request body or parameters
- 401 Unauthorized: Middleware authentication failed
- 500 Internal Server Error: Unhandled exceptions

```typescript
// Error Response Format
{
  error: string;  // Error message
}
``` 