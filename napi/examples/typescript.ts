/**
 * TypeScript Zap server example
 * 
 * Demonstrates type-safe API with full IntelliSense support
 */

import { Zap, Request, TypedRequest, RouteParams } from '../index';

// Type-safe route parameters
type UserRouteParams = RouteParams<'/users/:id'>;
type PostRouteParams = RouteParams<'/users/:userId/posts/:postId'>;

interface User {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}

interface CreateUserRequest {
  name: string;
  email: string;
}

async function main(): Promise<void> {
  const server = new Zap();
  
  // Server configuration with type safety
  await server.port(3000);
  await server.hostname('127.0.0.1');
  await server.max_request_body_size(10 * 1024 * 1024); // 10MB
  await server.cors();
  await server.logging();
  
  // Simple routes with type inference
  await server.get('/', (): string => 'Welcome to TypeScript Zap! 🔥');
  
  // Type-safe route parameters
  await server.get_json('/users/:id', (req: TypedRequest<'/users/:id'>) => {
    const { id } = req.params; // TypeScript knows this is a string
    
    const user: User = {
      id: parseInt(id),
      name: 'John Doe',
      email: `user${id}@example.com`,
      createdAt: new Date().toISOString()
    };
    
    return user;
  });
  
  // Complex nested parameters
  await server.get_json('/users/:userId/posts/:postId', (req: TypedRequest<'/users/:userId/posts/:postId'>) => {
    const { userId, postId } = req.params; // Both typed as strings
    
    return {
      userId: parseInt(userId),
      postId: parseInt(postId),
      title: `Post ${postId} by User ${userId}`,
      content: 'This is a sample post with type-safe parameters',
      author: {
        id: parseInt(userId),
        name: 'Author Name'
      }
    };
  });
  
  // POST endpoint with request body typing
  await server.post_json('/api/users', (req: Request) => {
    try {
      const userData: CreateUserRequest = JSON.parse(req.body);
      
      // Validate required fields
      if (!userData.name || !userData.email) {
        return {
          error: 'Missing required fields',
          required: ['name', 'email']
        };
      }
      
      const newUser: User = {
        id: Math.floor(Math.random() * 1000),
        name: userData.name,
        email: userData.email,
        createdAt: new Date().toISOString()
      };
      
      return {
        success: true,
        user: newUser,
        message: 'User created successfully'
      };
    } catch (error) {
      return {
        error: 'Invalid JSON in request body',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });
  
  // Advanced query parameter handling
  await server.get_json('/api/search', (req: Request) => {
    const query = req.query.q || '';
    const page = parseInt(req.query.page || '1');
    const limit = Math.min(parseInt(req.query.limit || '10'), 100); // Max 100 items
    const sortBy = req.query.sort || 'created_at';
    const sortOrder = req.query.order === 'desc' ? 'desc' : 'asc';
    
    interface SearchResult {
      id: number;
      title: string;
      snippet: string;
      score: number;
    }
    
    const results: SearchResult[] = Array.from({ length: limit }, (_, i) => ({
      id: (page - 1) * limit + i + 1,
      title: `Result ${i + 1} for "${query}"`,
      snippet: `This is a search result snippet containing "${query}"...`,
      score: Math.random() * 100
    }));
    
    return {
      query,
      page,
      limit,
      sortBy,
      sortOrder,
      results,
      total: 1000,
      totalPages: Math.ceil(1000 / limit)
    };
  });
  
  // Error handling example
  await server.get_async('/api/error', async (req: Request) => {
    throw new Error('This is a test error');
  });
  
  // File upload example (simplified)
  await server.post_json('/api/upload', (req: Request) => {
    const contentType = req.headers['content-type'] || '';
    
    if (!contentType.startsWith('multipart/form-data')) {
      return {
        error: 'Content-Type must be multipart/form-data',
        received: contentType
      };
    }
    
    return {
      message: 'File upload processed',
      size: req.body.length,
      contentType,
      timestamp: new Date().toISOString()
    };
  });
  
  // Health check with detailed info
  await server.get_json('/health', () => ({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0',
    node: process.version
  }));
  
  // Static files with type-safe options
  await server.static_files('/assets', './public', {
    directory_listing: false,
    cache_control: 'public, max-age=31536000',
    headers: {
      'X-Served-By': 'Zap-TypeScript'
    },
    compress: true
  });
  
  console.log('🔥 TypeScript Zap server starting...');
  console.log('📊 Type-safe endpoints:');
  console.log('  GET  /users/:id - User profile (typed params)');
  console.log('  GET  /users/:userId/posts/:postId - Nested params');
  console.log('  POST /api/users - Create user (typed body)');
  console.log('  GET  /api/search - Advanced search (typed query)');
  console.log('  POST /api/upload - File upload');
  console.log('  GET  /health - Health check');
  console.log('');
  console.log('🌐 Server running on http://127.0.0.1:3000');
  console.log('💡 Try: curl -H "Content-Type: application/json" -d \'{"name":"Alice","email":"alice@example.com"}\' http://127.0.0.1:3000/api/users');
  
  await server.listen();
}

main().catch((error: Error) => {
  console.error('❌ Server failed to start:', error);
  process.exit(1);
}); 