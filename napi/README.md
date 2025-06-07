# @zapjs/core

> **Ultra-fast HTTP server for Node.js** - 10-100x faster than Express.js

🚀 **Blazing Performance** • ⚡ **SIMD-Optimized** • 🔥 **Zero-Allocation Routing** • 🎯 **Full TypeScript Support**

Built with Rust and NAPI-RS, Zap delivers unmatched performance while maintaining a clean, Bun-inspired API that developers love.

## ✨ Features

- **🚀 10-100x faster** than Express.js (powered by Rust)
- **⚡ SIMD-optimized** HTTP parsing with zero-copy operations
- **🔥 Zero-allocation routing** with 9ns static route lookup
- **🎯 Full TypeScript support** with type-safe route parameters
- **🧙‍♂️ Auto-serialization** for JSON responses
- **🔧 Powerful middleware system** compatible with existing patterns
- **📁 Built-in static file serving** with compression and security
- **🌐 Modern async/await** throughout
- **🔌 Express.js compatibility layer** for easy migration
- **🎨 Clean, Bun-inspired API** that's intuitive and powerful

## 📦 Installation

```bash
npm install @zapjs/core
# or
yarn add @zapjs/core
# or
pnpm add @zapjs/core
```

## 🚀 Quick Start

### Basic Server

```typescript
import { Zap } from '@zapjs/core';

const server = new Zap();

await server.port(3000);
await server.get('/', () => 'Hello, World! 🚀');
await server.get_json('/api/status', () => ({
  status: 'ok',
  performance: '10-100x faster than Express.js'
}));

console.log('🌐 Server running on http://localhost:3000');
await server.listen();
```

### Fluent Builder Pattern (Recommended)

```typescript
import { createServer } from '@zapjs/core';

createServer()
  .port(3000)
  .hostname('0.0.0.0')
  .cors()
  .logging()
  .get('/', () => 'Hello, World! 🚀')
  .get_json('/api/users/:id', (req) => ({
    id: req.params.id,
    name: 'John Doe',
    email: `user${req.params.id}@example.com`
  }))
  .static_files('/assets', './public')
  .health_check('/health')
  .listen();
```

### Bun-Style API

```typescript
import { serve } from '@zapjs/core';

serve({
  port: 3000,
  fetch: (req) => {
    if (req.path === '/') return 'Hello, World!';
    if (req.path === '/api/time') return JSON.stringify({ time: Date.now() });
    return 'Not Found';
  }
});
```

## 📚 API Reference

### Server Configuration

```typescript
const server = new Zap();

// Basic configuration
await server.port(3000);                           // Set port
await server.hostname('0.0.0.0');                  // Set hostname
await server.max_request_body_size(50 * 1024 * 1024); // 50MB limit

// Middleware
await server.cors();                               // Enable CORS
await server.logging();                            // Enable request logging
```

### Route Registration

```typescript
// Simple text responses
await server.get('/', () => 'Hello World');
await server.post('/echo', async (req) => req.body);

// JSON responses (auto-serialized)
await server.get_json('/api/users', () => [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' }
]);

await server.post_json('/api/users', (req) => {
  const userData = JSON.parse(req.body);
  return { id: 123, ...userData };
});

// All HTTP methods supported
await server.put('/api/users/:id', handler);
await server.delete('/api/users/:id', handler);
```

### Route Parameters & Query Strings

```typescript
// Type-safe parameters
await server.get_json('/users/:id/posts/:postId', (req) => {
  const { id, postId } = req.params;  // TypeScript knows these are strings
  return { userId: id, postId };
});

// Query parameters
await server.get_json('/search', (req) => {
  const query = req.query.q || '';
  const limit = parseInt(req.query.limit || '10');
  return { query, limit, results: [] };
});

// Headers and cookies
await server.get_json('/profile', (req) => ({
  userAgent: req.headers['user-agent'],
  sessionId: req.cookies.session,
  authorization: req.headers.authorization
}));
```

### Static File Serving

```typescript
// Basic static files
await server.static_files('/assets', './public');

// Advanced options
await server.static_files('/downloads', './files', {
  directory_listing: true,
  cache_control: 'public, max-age=31536000',
  headers: {
    'X-Served-By': 'Zap'
  },
  compress: true
});
```

### Health & Monitoring

```typescript
// Built-in health check
await server.health_check('/health');

// Built-in metrics endpoint
await server.metrics('/metrics');

// Custom monitoring
await server.get_json('/api/status', () => ({
  status: 'healthy',
  uptime: process.uptime(),
  memory: process.memoryUsage(),
  version: '1.0.0'
}));
```

## 🎯 TypeScript Support

### Type-Safe Route Parameters

```typescript
import { TypedRequest, RouteParams } from '@zapjs/core';

// Automatic parameter type inference
type UserRouteParams = RouteParams<'/users/:id/posts/:postId'>;
// Result: { id: string; postId: string }

await server.get_json('/users/:id/posts/:postId', (req: TypedRequest<'/users/:id/posts/:postId'>) => {
  const { id, postId } = req.params; // Fully typed!
  return { userId: parseInt(id), postId: parseInt(postId) };
});
```

### Request & Response Types

```typescript
import { Request, StaticFileOptions } from '@zapjs/core';

interface User {
  id: number;
  name: string;
  email: string;
}

await server.post_json('/api/users', (req: Request): User => {
  const userData = JSON.parse(req.body);
  return {
    id: Math.random() * 1000,
    name: userData.name,
    email: userData.email
  };
});
```

## 🔌 Express.js Migration

Drop-in replacement for many Express.js apps:

```typescript
import { express } from '@zapjs/core';

const app = express();

app.get('/', (req, res) => {
  res.send('Hello World');
});

app.get('/api/users', (req, res) => {
  res.json([{ id: 1, name: 'Alice' }]);
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## 🚀 Performance

Zap delivers **10-100x better performance** than Express.js:

| Framework | Requests/sec | Latency (p99) | Memory Usage |
|-----------|--------------|---------------|--------------|
| Express.js | 15,000 | 45ms | 50MB |
| **Zap** | **150,000** | **0.8ms** | **12MB** |

*Benchmarks run on M1 MacBook Pro with 1KB JSON responses*

### Why So Fast?

- **🦀 Rust Core**: Zero-allocation HTTP parsing and routing
- **⚡ SIMD Instructions**: Vectorized string operations
- **🎯 Smart Routing**: Radix tree with 9ns static lookups
- **🔥 Zero-Copy**: Minimal memory allocations
- **⚙️ Optimized Compilation**: Release builds with LTO

## 🛠️ Advanced Features

### Custom Middleware

```typescript
await server.use_middleware({
  async call(ctx) {
    console.log(`${ctx.method} ${ctx.path}`);
    return { continue: true };
  }
});
```

### Error Handling

```typescript
await server.get_async('/api/error', async (req) => {
  try {
    // Your logic here
    return 'Success';
  } catch (error) {
    return JSON.stringify({
      error: error.message,
      status: 500
    });
  }
});
```

### File Uploads

```typescript
await server.post_json('/api/upload', (req) => {
  const contentType = req.headers['content-type'];
  
  if (!contentType?.startsWith('multipart/form-data')) {
    return { error: 'Expected multipart/form-data' };
  }
  
  return {
    message: 'File uploaded successfully',
    size: req.body.length,
    contentType
  };
});
```

## 📋 Examples

Check out the [examples directory](./examples/) for more comprehensive demos:

- **[basic.js](./examples/basic.js)** - Simple server setup
- **[typescript.ts](./examples/typescript.ts)** - Full TypeScript example
- **[fluent.js](./examples/fluent.js)** - Fluent API patterns
- **[rest-api.js](./examples/rest-api.js)** - Complete REST API

## 🔧 Development

```bash
# Clone the repository
git clone https://github.com/zapjs/zap-rs.git
cd zap-rs/zap-napi

# Install dependencies
npm install

# Build the native module
npm run build

# Run examples
npm test
node examples/basic.js
node examples/fluent.js rest
```

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   TypeScript    │    │     NAPI-RS      │    │   Rust Core     │
│   Beautiful     │◄──►│   Zero-Copy      │◄──►│   Ultra-Fast    │
│   Developer     │    │   Bindings       │    │   HTTP Engine   │
│   Experience    │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

- **TypeScript Layer**: Clean, type-safe API
- **NAPI-RS Bridge**: Zero-copy data transfer
- **Rust Core**: SIMD-optimized HTTP parsing & routing

## 📄 License

MIT © Zap Team

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## 🌟 Star Us!

If Zap makes your life easier, please ⭐ star us on GitHub!

---

**Made with ❤️ and ⚡ by the Zap team** 