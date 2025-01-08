# Zap Router Implementation

## Architecture Overview

The Zap Router is implemented as a hybrid system combining Rust's performance with TypeScript's developer experience:

### Core Components

1. Rust Implementation (`crates/`)
   - `zap-types`: Core type definitions shared between Rust and TypeScript
   - `zap-core`: High-performance router implementation with:
     - Radix tree-based routing
     - LRU caching
     - Rate limiting
     - Parameter extraction
     - Wildcard support
   - `zap-macros`: Rust procedural macros for route registration

2. TypeScript Layer (`packages/npm-zap`)
   - Controller-based architecture
   - Namespace-based decorator API
   - Type-safe route definitions
   - Express.js integration
   - Automatic binary management

### Decorator System

1. Controller Decorator
```typescript
// Base controller with authentication middleware
@zap.controller('/api', [authenticate])
class UserController {
  // Routes will be prefixed with '/api'
}

// Simple controller without middleware
@zap.controller('/public')
class PublicController {
  // Routes will be prefixed with '/public'
}
```

2. HTTP Method Decorators
```typescript
class UserController {
  @zap.get('/users')                // GET /api/users
  async getUsers() {}

  @zap.post('/users')               // POST /api/users
  async createUser() {}

  @zap.put('/users/:id')           // PUT /api/users/:id
  async updateUser() {}

  @zap.delete('/users/:id')        // DELETE /api/users/:id
  async deleteUser() {}

  @zap.patch('/users/:id')         // PATCH /api/users/:id
  async partialUpdate() {}

  @zap.head('/status')            // HEAD /api/status
  async checkStatus() {}

  @zap.options('/users')          // OPTIONS /api/users
  async getUserOptions() {}
}
```

3. Parameter Decorators
```typescript
class UserController {
  @zap.get('/users/:id/posts/:postId')
  async getPost(
    @zap.param('id') userId: string,      // Route parameter
    @zap.param('postId') postId: string,  // Route parameter
    @zap.query('include') include: string, // Query parameter
    @zap.header('x-api-key') apiKey: string // Header
  ) {}

  @zap.post('/users')
  async createUser(
    @zap.body() userData: UserDto         // Request body
  ) {}
}
```

4. Middleware Decorators
```typescript
class UserController {
  @zap.use(logRequest, validateSession)   // Multiple middleware
  @zap.get('/users')
  async getUsers() {}

  @zap.guard(isAdmin)                     // Guard middleware
  @zap.post('/admin/users')
  async createAdminUser() {}

  @zap.validate(userSchema)               // Validation middleware
  @zap.post('/users')
  async createUser() {}
}
```

5. Response Decorators
```typescript
class UserController {
  @zap.response(addTimestamp)             // Transform response
  @zap.status(201)                        // Set status code
  @zap.post('/users')
  async createUser() {
    return { id: '123' };
    // Response: { id: '123', timestamp: 1234567890 }
  }
}
```

6. Performance Decorators
```typescript
class UserController {
  @zap.cache(1000, 60)                    // Cache 1000 items for 60s
  @zap.get('/users')
  async getUsers() {}

  @zap.rateLimit(5, 60)                   // 5 requests per minute
  @zap.post('/login')
  async login() {}
}
```

### Advanced Usage Examples

1. Combining Multiple Decorators
```typescript
@zap.controller('/api')
class UserController {
  @zap.get('/users')
  @zap.cache(1000, 60)
  @zap.use(authenticate)
  @zap.response(addMetadata)
  @zap.status(200)
  async getUsers(
    @zap.query('page') page: number,
    @zap.query('limit') limit: number,
    @zap.header('x-trace-id') traceId: string
  ) {
    return { users: [] };
  }
}
```

2. Custom Decorator Composition
```typescript
function AdminEndpoint() {
  return function(target: any, key: string, descriptor: PropertyDescriptor) {
    zap.guard(isAdmin)(target, key, descriptor);
    zap.rateLimit(1000, 60)(target, key, descriptor);
    zap.response(addAuditLog)(target, key, descriptor);
    return descriptor;
  }
}

@zap.controller('/admin')
class AdminController {
  @AdminEndpoint()
  @zap.post('/users')
  async createUser(@zap.body() userData: AdminUserDto) {
    return { status: 'created' };
  }
}
```

3. Error Handling
```typescript
@zap.controller('/api')
class UserController {
  @zap.get('/users/:id')
  @zap.response(handleError)
  async getUser(@zap.param('id') id: string) {
    const user = await findUser(id);
    if (!user) {
      throw new Error('User not found');
      // Transformed to: { error: 'User not found', status: 404 }
    }
    return user;
  }
}
```

4. Validation with Schema
```typescript
const userSchema = {
  username: { type: 'string', required: true },
  email: { type: 'string', format: 'email' },
  age: { type: 'number', minimum: 18 }
};

@zap.controller('/api')
class UserController {
  @zap.post('/users')
  @zap.validate(userSchema)
  async createUser(@zap.body() user: UserDto) {
    // Only called if validation passes
    return { status: 'created' };
  }
}
```

### Communication Flow

1. TypeScript decorators define routes and middleware
2. Rust binary runs as a local TCP server
3. TypeScript layer communicates via IPC:
   - Route registration
   - Request handling
   - Response transformation

### Performance Features

1. Zero-copy routing where possible
2. Efficient parameter extraction
3. LRU caching with TTL
4. Rate limiting per route
5. Concurrent request handling

### Project Structure

```
zap-rs/
├── crates/
│   ├── zap-core/      # Core Rust implementation
│   ├── zap-macros/    # Rust proc macros
│   └── zap-types/     # Shared types
├── packages/
│   └── npm-zap/       # TypeScript package
│       ├── src/       # TypeScript source
│       ├── scripts/   # Install scripts
│       └── bin/       # Binary output
├── docs/              # Documentation
├── Cargo.toml         # Workspace config
└── build.sh          # Build script
```

### Build Process

1. Rust components:
   - Compile core library
   - Generate platform-specific binaries
   - Run tests and benchmarks

2. TypeScript package:
   - Compile TypeScript
   - Generate type definitions
   - Package for npm distribution

3. Development workflow:
   - Local binary building
   - Skip binary download
   - Hot reload support
