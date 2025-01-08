# TypeScript Guide

## Overview

zap-rs provides a comprehensive set of TypeScript decorators for building type-safe APIs. This guide covers all the features and best practices.

## Basic Setup

1. Install the package:
```bash
npm install zap-rs
```

2. Configure TypeScript:
```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

## Core Concepts

### Controllers

Controllers group related routes under a common path prefix:

```typescript
import { zap } from 'zap-rs';

@zap.controller('/api')
class UserController {
  // Routes will be prefixed with /api
}
```

### Routes

Define routes using HTTP method decorators:

```typescript
@zap.controller('/api')
class UserController {
  @zap.get('/users')
  async getUsers() {
    return { users: [] };
  }

  @zap.post('/users')
  async createUser() {
    return { created: true };
  }

  @zap.put('/users/:id')
  async updateUser() {
    return { updated: true };
  }

  @zap.delete('/users/:id')
  async deleteUser() {
    return { deleted: true };
  }
}
```

### Parameter Handling

Extract data from requests using parameter decorators:

```typescript
@zap.controller('/api')
class UserController {
  @zap.get('/users/:id')
  async getUser(
    @zap.param('id') id: string,           // Path parameter
    @zap.query('fields') fields: string,   // Query parameter
    @zap.header('x-api-key') apiKey: string // Header
  ) {
    return { id, fields };
  }

  @zap.post('/users')
  async createUser(
    @zap.body() userData: UserDto          // Request body
  ) {
    return { created: true };
  }
}
```

### Middleware

Apply middleware at controller or route level:

```typescript
// Middleware function
const authenticate = async (request: Request): Promise<boolean> => {
  const apiKey = request.headers.find(([k]) => k === 'x-api-key')?.[1];
  return apiKey === 'valid-key';
};

// Controller-level middleware
@zap.controller('/api', [authenticate])
class ApiController {
  // All routes require authentication
}

// Route-level middleware
@zap.controller('/public')
class PublicController {
  @zap.use(authenticate)
  @zap.get('/protected')
  async getProtected() {
    // Only accessible with valid authentication
  }
}
```

### Request Validation

Validate request data:

```typescript
const userSchema = {
  username: { type: 'string', required: true },
  email: { type: 'string', format: 'email' }
};

@zap.controller('/api')
class UserController {
  @zap.post('/users')
  @zap.validate(userSchema)
  async createUser(@zap.body() user: UserDto) {
    // Only called if validation passes
    return { created: true };
  }
}
```

### Response Transformation

Transform and customize responses:

```typescript
const addTimestamp = (data: any) => ({
  ...data,
  timestamp: Date.now()
});

@zap.controller('/api')
class UserController {
  @zap.get('/users')
  @zap.response(addTimestamp)
  @zap.status(200)
  async getUsers() {
    return { users: [] };
    // Response: { users: [], timestamp: 1234567890 }
  }
}
```

## Type Safety

### Request Types

Define types for request bodies:

```typescript
interface CreateUserDto {
  username: string;
  email: string;
}

interface UpdateUserDto {
  username?: string;
  email?: string;
}

@zap.controller('/api')
class UserController {
  @zap.post('/users')
  async createUser(@zap.body() user: CreateUserDto) {
    // user is typed as CreateUserDto
  }

  @zap.patch('/users/:id')
  async updateUser(
    @zap.param('id') id: string,
    @zap.body() updates: UpdateUserDto
  ) {
    // updates is typed as UpdateUserDto
  }
}
```

### Error Handling

Handle errors with type-safe error responses:

```typescript
class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

@zap.controller('/api')
class UserController {
  @zap.get('/users/:id')
  async getUser(@zap.param('id') id: string) {
    const user = await findUser(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  }
}
```

## Best Practices

1. **Use TypeScript Interfaces**
   - Define interfaces for request/response bodies
   - Use strict types for parameters

2. **Middleware Organization**
   - Apply authentication at controller level
   - Use route-specific middleware for unique requirements

3. **Error Handling**
   - Create custom error classes
   - Use appropriate HTTP status codes
   - Provide meaningful error messages

4. **Code Organization**
   - Group related routes in controllers
   - Keep controllers focused and single-purpose
   - Use middleware for cross-cutting concerns

5. **Validation**
   - Always validate request bodies
   - Use schemas for complex validations
   - Handle validation errors gracefully

6. **Response Formatting**
   - Be consistent with response structures
   - Use response transformers for common patterns
   - Set appropriate status codes 