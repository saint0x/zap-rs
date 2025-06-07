/**
 * Basic Zap server example
 * 
 * Demonstrates the clean, Bun-inspired API for building ultra-fast HTTP servers
 */

const { Zap } = require('../index');

async function main() {
  const server = new Zap();
  
  // Configure server
  await server.port(3000);
  await server.hostname('0.0.0.0');
  await server.cors();
  await server.logging();
  
  // Simple text routes
  await server.get('/', () => 'Hello, World! 🚀');
  await server.get('/about', () => 'Ultra-fast HTTP server powered by Rust');
  
  // Route with parameters
  await server.get_async('/users/:id', async (req) => {
    const { id } = req.params;
    return `User profile for ID: ${id}`;
  });
  
  // JSON API endpoints
  await server.get_json('/api/status', () => ({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    performance: '10-100x faster than Express.js'
  }));
  
  await server.post_json('/api/users', (req) => {
    console.log('Received body:', req.body);
    return {
      message: 'User created successfully',
      id: Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString()
    };
  });
  
  // Query parameters example
  await server.get_async('/search', async (req) => {
    const query = req.query.q || '';
    const limit = parseInt(req.query.limit) || 10;
    
    return JSON.stringify({
      query,
      limit,
      results: [`Result 1 for "${query}"`, `Result 2 for "${query}"`],
      total: 42
    });
  });
  
  // Health check and metrics
  await server.health_check('/health');
  await server.metrics('/metrics');
  
  // Static files (uncomment if you have a public directory)
  // await server.static_files('/assets', './public');
  
  console.log('🚀 Zap server starting...');
  console.log('📊 Available endpoints:');
  console.log('  GET  / - Hello World');
  console.log('  GET  /about - About page');
  console.log('  GET  /users/:id - User profile');
  console.log('  GET  /api/status - Server status (JSON)');
  console.log('  POST /api/users - Create user (JSON)');
  console.log('  GET  /search?q=term&limit=10 - Search');
  console.log('  GET  /health - Health check');
  console.log('  GET  /metrics - Server metrics');
  console.log('');
  console.log('🌐 Server running on http://localhost:3000');
  console.log('💡 Try: curl http://localhost:3000/api/status');
  
  await server.listen();
}

main().catch(console.error); 