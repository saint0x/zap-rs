# Installation Guide

## Quick Install

```bash
npm install zap-rs
```

The package automatically:
- Downloads the appropriate Rust binary for your platform
- Sets up proper permissions
- Configures TypeScript decorators

## TypeScript Configuration

Enable decorators in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

## Quick Start

Create a new file `app.ts`:

```typescript
import { zap } from 'zap-rs';
import express from 'express';

@zap.controller('/api')
class UserController {
  @zap.get('/users')
  async getUsers() {
    return { users: [] };
  }

  @zap.get('/users/:id')
  async getUser(@zap.param('id') id: string) {
    return { id };
  }
}

const app = express();
app.use(zap.handler());
app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
```

## Platform Support

Works on all major platforms:
- ✅ macOS (x64, arm64)
- ✅ Linux (x64, arm64)
- ✅ Windows (x64, arm64)

## Requirements

- Node.js 14+
- TypeScript 4.5+ (for decorator support)

## Troubleshooting

### Binary Issues

If you encounter binary-related issues:

```bash
# Retry binary download
npm rebuild zap-rs

# Check binary permissions
chmod +x ./node_modules/zap-rs/bin/zap-*

# Verify platform support
node -e "console.log(process.platform, process.arch)"
```

### TypeScript Issues

If you see decorator-related errors:

1. Check your `tsconfig.json`:
```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "target": "ES2015"
  }
}
```

2. Make sure you're using TypeScript 4.5+:
```bash
npm list typescript
```

### Common Solutions

1. **"Binary not found"**
   - Run `npm rebuild zap-rs`
   - Check binary permissions
   - Verify platform support

2. **"Decorator errors"**
   - Update TypeScript configuration
   - Update TypeScript version
   - Clear TypeScript cache

3. **"Import errors"**
   - Check package installation
   - Verify import paths
   - Clear npm cache

## Next Steps

After installation:
1. Read the [TypeScript Guide](typescript.md)
2. Check the [API Reference](api-reference.md)
3. Start building your API! 