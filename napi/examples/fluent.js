/**
 * Fluent Builder Pattern Example
 * 
 * Demonstrates the clean, chainable Bun-inspired API
 */

const { createServer, serve, express } = require('../index');

// Example 1: Fluent builder pattern (most recommended)
async function fluentExample() {
  console.log('🔥 Starting fluent builder pattern example...\n');
  
  const server = createServer()
    .port(3001)
    .hostname('127.0.0.1')
    .cors()
    .logging()
    
    // Chain route definitions
    .get('/', () => 'Hello from fluent API! 🚀')
    .get('/ping', () => 'pong')
    .get_json('/api/info', () => ({
      framework: 'Zap',
      style: 'fluent',
      performance: '10-100x faster than Express'
    }))
    
    // Health and monitoring
    .health_check('/health')
    .metrics('/metrics')
    
    // Static files
    .static_files('/assets', './examples', {
      cache_control: 'public, max-age=3600'
    });
  
  console.log('🌐 Fluent server running on http://127.0.0.1:3001');
  console.log('💡 Try: curl http://127.0.0.1:3001/api/info\n');
  
  return server.listen();
}

// Example 2: Bun-inspired serve function
async function bunStyleExample() {
  console.log('🔥 Starting Bun-style serve example...\n');
  
  return serve({
    port: 3002,
    hostname: '127.0.0.1',
    fetch: async (req) => {
      const url = new URL(req.path, 'http://localhost');
      
      switch (url.pathname) {
        case '/':
          return 'Hello from Bun-style API! 🔥';
          
        case '/api/time':
          return JSON.stringify({
            timestamp: new Date().toISOString(),
            unix: Date.now(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          });
          
        case '/user':
          return JSON.stringify({
            id: Math.floor(Math.random() * 1000),
            name: 'Bun User',
            active: true
          });
          
        default:
          return 'Not Found';
      }
    }
  });
}

// Example 3: Express.js compatibility layer
async function expressCompatExample() {
  console.log('🔥 Starting Express.js compatibility example...\n');
  
  const app = express();
  
  app.get('/', (req, res) => {
    res.send('Hello from Express compatibility! ⚡');
  });
  
  app.get('/api/compat', (req, res) => {
    res.json({
      message: 'Express.js compatible API',
      performance: 'But 10-100x faster!',
      powered_by: 'Zap + Rust'
    });
  });
  
  app.post('/api/echo', (req, res) => {
    res.json({
      echo: req.body,
      headers: req.headers,
      method: req.method
    });
  });
  
  console.log('🌐 Express-compatible server running on http://127.0.0.1:3003');
  console.log('💡 Try: curl http://127.0.0.1:3003/api/compat\n');
  
  return app.listen(3003, () => {
    console.log('Express-style callback executed!');
  });
}

// Example 4: Advanced REST API
async function restApiExample() {
  console.log('🔥 Starting advanced REST API example...\n');
  
  // In-memory data store
  const users = new Map([
    [1, { id: 1, name: 'Alice', email: 'alice@example.com' }],
    [2, { id: 2, name: 'Bob', email: 'bob@example.com' }]
  ]);
  
  const server = createServer()
    .port(3004)
    .cors()
    .logging()
    
    // GET /api/users - List all users
    .get_json('/api/users', () => Array.from(users.values()))
    
    // GET /api/users/:id - Get specific user
    .get_json('/api/users/:id', (req) => {
      const id = parseInt(req.params.id);
      const user = users.get(id);
      
      if (!user) {
        return { error: 'User not found', id };
      }
      
      return user;
    })
    
    // POST /api/users - Create new user
    .post_json('/api/users', (req) => {
      try {
        const userData = JSON.parse(req.body);
        const id = Math.max(...users.keys()) + 1;
        
        const newUser = {
          id,
          name: userData.name || 'Unknown',
          email: userData.email || `user${id}@example.com`
        };
        
        users.set(id, newUser);
        
        return {
          success: true,
          user: newUser,
          total_users: users.size
        };
      } catch (error) {
        return { error: 'Invalid JSON', message: error.message };
      }
    })
    
    // PUT /api/users/:id - Update user
    .put('/api/users/:id', async (req) => {
      const id = parseInt(req.params.id);
      const existingUser = users.get(id);
      
      if (!existingUser) {
        return JSON.stringify({ error: 'User not found', id });
      }
      
      try {
        const updates = JSON.parse(req.body);
        const updatedUser = { ...existingUser, ...updates, id };
        users.set(id, updatedUser);
        
        return JSON.stringify({
          success: true,
          user: updatedUser,
          updated_fields: Object.keys(updates)
        });
      } catch (error) {
        return JSON.stringify({ error: 'Invalid JSON', message: error.message });
      }
    })
    
    // DELETE /api/users/:id - Delete user
    .delete('/api/users/:id', async (req) => {
      const id = parseInt(req.params.id);
      const existed = users.has(id);
      
      if (existed) {
        users.delete(id);
        return JSON.stringify({
          success: true,
          message: `User ${id} deleted`,
          remaining_users: users.size
        });
      } else {
        return JSON.stringify({
          error: 'User not found',
          id,
          available_ids: Array.from(users.keys())
        });
      }
    })
    
    // API documentation
    .get_json('/api', () => ({
      name: 'Zap REST API Example',
      version: '1.0.0',
      endpoints: {
        'GET /api/users': 'List all users',
        'GET /api/users/:id': 'Get specific user',
        'POST /api/users': 'Create new user',
        'PUT /api/users/:id': 'Update user',
        'DELETE /api/users/:id': 'Delete user'
      },
      performance: '10-100x faster than Express.js',
      powered_by: 'Rust + NAPI-RS'
    }));
  
  console.log('🌐 REST API server running on http://127.0.0.1:3004');
  console.log('📚 API documentation: http://127.0.0.1:3004/api');
  console.log('💡 Try: curl http://127.0.0.1:3004/api/users\n');
  
  return server.listen();
}

// Run examples based on command line argument
async function main() {
  const example = process.argv[2] || 'fluent';
  
  switch (example) {
    case 'fluent':
      await fluentExample();
      break;
    case 'bun':
      await bunStyleExample();
      break;
    case 'express':
      await expressCompatExample();
      break;
    case 'rest':
      await restApiExample();
      break;
    case 'all':
      console.log('🚀 Starting all examples in parallel...\n');
      await Promise.all([
        fluentExample(),
        bunStyleExample(),
        expressCompatExample(),
        restApiExample()
      ]);
      break;
    default:
      console.log('Available examples: fluent, bun, express, rest, all');
      console.log('Usage: node fluent.js [example]');
      process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Example failed:', error);
  process.exit(1);
}); 