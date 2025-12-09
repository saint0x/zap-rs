# ⚡ Zap

Ultra-fast HTTP framework written in Rust with TypeScript bindings using Unix domain socket IPC.

Production-grade server combining Rust performance with TypeScript flexibility.

## Architecture

```
TypeScript Wrapper (Node.js/Bun)
    ↓ (handler registration)
Zap class (src/index.ts)
    ├─ ProcessManager (spawns Rust binary)
    └─ IpcServer (listens on Unix socket)
         ↓ (newline-delimited JSON over IPC)
Rust Binary (server/bin/zap.rs)
    ├─ HTTP Server (Hyper + Tokio)
    ├─ Router (9ns static routes, zap-core)
    ├─ Middleware chain (CORS, logging)
    └─ ProxyHandler (forwards TS routes via IPC)
         ↓ (HTTP response)
HTTP Clients (3000+)
```

## Features

- **9ns static route lookups** - Ultra-fast radix tree router
- **SIMD-optimized HTTP parsing** - Zero-copy request handling
- **TypeScript handlers** - Full Node.js/Bun ecosystem access
- **Production-ready** - Graceful shutdown, health checks, metrics
- **Minimal IPC overhead** - Unix domain sockets (~100μs latency)
- **Type-safe IPC protocol** - Newline-delimited JSON with error handling

## Quick Start

### Prerequisites
- Bun 1.0+ or Node.js 16+
- Rust 1.70+ (for building)

### Build

```bash
# Build Rust binary
cargo build --release --bin zap

# Build TypeScript wrapper
npm run build:ts

# Or both at once
npm run build
```

### Usage

```typescript
import Zap from './src/index';

const app = new Zap({ port: 3000 })
  .cors()
  .logging();

app.get('/', () => ({ message: 'Hello!' }));
app.get('/users/:id', (req) => ({
  userId: req.params.id,
  name: `User ${req.params.id}`
}));

await app.listen();
```

### Testing

```typescript
import Zap from './src/index';

const app = new Zap({ port: 3001 });
app.get('/test', () => ({ ok: true }));
await app.listen();

const res = await fetch('http://127.0.0.1:3001/test');
const data = await res.json();
console.log(data); // { ok: true }

await app.close();
```

## API

### Constructor

```typescript
new Zap(options?: {
  port?: number;
  hostname?: string;
  logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
})
```

### Configuration Methods (fluent)

```typescript
app
  .setPort(3000)
  .setHostname('0.0.0.0')
  .cors()
  .logging()
  .compression()
  .healthCheck('/health')
  .metrics('/metrics')
  .static('/public', './public');
```

### Route Methods

```typescript
app.get(path, handler);
app.post(path, handler);
app.put(path, handler);
app.delete(path, handler);
app.patch(path, handler);
app.head(path, handler);
```

### Lifecycle

```typescript
await app.listen(port?);
await app.close();
const running = app.isRunning();
```

## Handler Signature

Handlers receive a request object and return a response:

```typescript
(request: {
  method: string;
  path: string;
  path_only: string;
  query: Record<string, string>;
  params: Record<string, string>;
  headers: Record<string, string>;
  body: string;
  cookies: Record<string, string>;
}) => any | Promise<any>
```

Responses are auto-serialized:
- Strings → text/plain
- Objects → application/json
- Response instances → used directly

## Configuration File (Rust)

The TypeScript wrapper generates a JSON config for the Rust binary:

```json
{
  "port": 3000,
  "hostname": "127.0.0.1",
  "ipc_socket_path": "/tmp/zap-xxxx.sock",
  "routes": [
    {
      "method": "GET",
      "path": "/",
      "handler_id": "handler_0",
      "is_typescript": true
    }
  ],
  "static_files": [],
  "middleware": {
    "enable_cors": true,
    "enable_logging": true,
    "enable_compression": false
  },
  "health_check_path": "/health",
  "metrics_path": null
}
```

## Performance

| Operation | Latency | Notes |
|-----------|---------|-------|
| Static route (Rust) | 9ns | Router only |
| Parameter route (Rust) | 80-200ns | Router + extraction |
| IPC round trip | ~100μs | Local Unix socket |
| TS handler call | ~1-2ms | IPC + execution |
| Health check | <1ms | Direct HTTP |

## Development

### Run test example

```bash
npm run build
bun run TEST-IPC.ts
```

### Run integration tests

```bash
bun test tests/
```

### Debug logging

```typescript
new Zap({ logLevel: 'debug' })
```

Outputs from both Rust (stderr/stdout) and TypeScript are prefixed with `[Zap]`.

## Limitations

- **Unix sockets only** - No Windows support (requires TCP mode)
- **No hot reload** - Requires restart on handler changes
- **Single process** - No built-in clustering (use external load balancer)
- **Body as string** - Large bodies must be handled in TS
- **Request timeout** - Default 30s (configurable in Rust config)

## Project Structure

```
zap-rs/
├── core/                    # Rust router + HTTP parser library
├── server/                  # Rust binary + IPC implementation
│   ├── src/
│   │   ├── bin/zap.rs       # Binary entry point
│   │   ├── config.rs        # Configuration parsing
│   │   ├── ipc.rs           # IPC protocol
│   │   ├── proxy.rs         # IPC proxy handler
│   │   └── server.rs        # HTTP server
│   └── Cargo.toml
├── src/                     # TypeScript wrapper
│   ├── index.ts             # Main Zap class
│   ├── process-manager.ts   # Binary spawning
│   └── ipc-client.ts        # IPC server
├── tests/                   # Integration tests
├── tsconfig.json
├── package.json
└── README.md
```

## Building for Production

```bash
# Build optimized binary
cargo build --release --bin zap

# Build TypeScript
npm run build:ts

# Result:
# dist/
#   ├── index.js
#   ├── process-manager.js
#   └── ipc-client.js
#
# target/release/
#   └── zap
```

## Environment Variables

- `RUST_LOG` - Set Rust log level (trace, debug, info, warn, error)

## License

MIT
