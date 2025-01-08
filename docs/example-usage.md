# Example Usage

This guide demonstrates a complete server implementation using zap-rs, showcasing all major features in a realistic scenario.

## Complete Server Example

```typescript
import { zap } from 'zap-rs';
import express from 'express';
import { z } from 'zod'; // For runtime type validation

// Types
interface User {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
}

interface Post {
  id: string;
  userId: string;
  title: string;
  content: string;
  createdAt: number;
}

// Validation Schemas
const userSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8)
});

const postSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1)
});

// Middleware
const authenticate = async (request: Request): Promise<boolean> => {
  const apiKey = request.headers.find(([k]) => k === 'x-api-key')?.[1];
  return apiKey === 'valid-key';
};

const requireAdmin = async (request: Request): Promise<boolean> => {
  const userId = request.headers.find(([k]) => k === 'x-user-id')?.[1];
  const user = await findUser(userId!);
  return user?.role === 'admin';
};

const validate = (schema: z.ZodSchema) => async (request: Request): Promise<boolean> => {
  try {
    if (request.body) {
      schema.parse(JSON.parse(request.body));
    }
    return true;
  } catch (error) {
    return false;
  }
};

// Response Transformers
const addTimestamp = (data: any) => ({
  ...data,
  timestamp: Date.now()
});

const addRequestId = (data: any) => ({
  ...data,
  requestId: Math.random().toString(36).substring(7)
});

// Mock Database
const users = new Map<string, User>();
const posts = new Map<string, Post>();

const findUser = async (id: string): Promise<User | undefined> => users.get(id);
const findPost = async (id: string): Promise<Post | undefined> => posts.get(id);

// Controllers
@zap.controller('/api')
class BaseController {
  @zap.get('/health')
  @zap.response(addTimestamp)
  async healthCheck() {
    return { status: 'ok' };
  }
}

@zap.controller('/api/users', [authenticate])
class UserController {
  @zap.get('/')
  @zap.response(addRequestId)
  async getUsers(
    @zap.query('role') role?: string,
    @zap.query('limit') limit?: string
  ) {
    let result = Array.from(users.values());
    if (role) {
      result = result.filter(user => user.role === role);
    }
    if (limit) {
      result = result.slice(0, parseInt(limit));
    }
    return { users: result };
  }

  @zap.get('/:id')
  async getUser(@zap.param('id') id: string) {
    const user = await findUser(id);
    if (!user) {
      throw new Error('User not found');
    }
    return { user };
  }

  @zap.post('/')
  @zap.validate(validate(userSchema))
  @zap.status(201)
  async createUser(@zap.body() userData: any) {
    const id = Math.random().toString(36).substring(7);
    const user: User = {
      id,
      ...JSON.parse(userData),
      role: 'user'
    };
    users.set(id, user);
    return { user };
  }

  @zap.put('/:id')
  @zap.use(requireAdmin)
  async updateUser(
    @zap.param('id') id: string,
    @zap.body() updates: any
  ) {
    const user = await findUser(id);
    if (!user) {
      throw new Error('User not found');
    }
    const updatedUser = {
      ...user,
      ...JSON.parse(updates)
    };
    users.set(id, updatedUser);
    return { user: updatedUser };
  }

  @zap.delete('/:id')
  @zap.use(requireAdmin)
  @zap.status(204)
  async deleteUser(@zap.param('id') id: string) {
    users.delete(id);
    return null;
  }
}

@zap.controller('/api/posts', [authenticate])
class PostController {
  @zap.get('/')
  async getPosts(
    @zap.query('userId') userId?: string,
    @zap.query('limit') limit?: string
  ) {
    let result = Array.from(posts.values());
    if (userId) {
      result = result.filter(post => post.userId === userId);
    }
    if (limit) {
      result = result.slice(0, parseInt(limit));
    }
    return { posts: result };
  }

  @zap.get('/:id')
  async getPost(@zap.param('id') id: string) {
    const post = await findPost(id);
    if (!post) {
      throw new Error('Post not found');
    }
    return { post };
  }

  @zap.post('/')
  @zap.validate(validate(postSchema))
  @zap.status(201)
  async createPost(
    @zap.header('x-user-id') userId: string,
    @zap.body() postData: any
  ) {
    const id = Math.random().toString(36).substring(7);
    const post: Post = {
      id,
      userId,
      ...JSON.parse(postData),
      createdAt: Date.now()
    };
    posts.set(id, post);
    return { post };
  }

  @zap.delete('/:id')
  @zap.status(204)
  async deletePost(
    @zap.param('id') id: string,
    @zap.header('x-user-id') userId: string
  ) {
    const post = await findPost(id);
    if (!post) {
      throw new Error('Post not found');
    }
    if (post.userId !== userId) {
      throw new Error('Unauthorized');
    }
    posts.delete(id);
    return null;
  }
}

// Server Setup
const app = express();
app.use(zap.handler());
app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
```

## Testing the API

Here are some example requests to test the API:

```bash
# Health Check
curl http://localhost:3000/api/health

# Create User
curl -X POST http://localhost:3000/api/users \
  -H "x-api-key: valid-key" \
  -H "Content-Type: application/json" \
  -d '{"username": "john", "email": "john@example.com", "password": "password123"}'

# Get Users
curl http://localhost:3000/api/users \
  -H "x-api-key: valid-key"

# Create Post
curl -X POST http://localhost:3000/api/posts \
  -H "x-api-key: valid-key" \
  -H "x-user-id: user123" \
  -H "Content-Type: application/json" \
  -d '{"title": "Hello World", "content": "My first post!"}'

# Get User's Posts
curl http://localhost:3000/api/posts?userId=user123 \
  -H "x-api-key: valid-key"
```

## Key Features Demonstrated

1. **Route Organization**
   - Controllers for different resources
   - Nested routes with parameters
   - Query parameter handling

2. **Authentication & Authorization**
   - Global authentication middleware
   - Role-based access control
   - Per-route authorization

3. **Request Validation**
   - Schema-based validation
   - Custom validation middleware
   - Type-safe request handling

4. **Response Handling**
   - Custom status codes
   - Response transformation
   - Error handling

5. **Middleware Patterns**
   - Controller-level middleware
   - Route-specific middleware
   - Validation middleware

6. **Type Safety**
   - Interface definitions
   - Runtime type checking
   - Type-safe parameters
``` 