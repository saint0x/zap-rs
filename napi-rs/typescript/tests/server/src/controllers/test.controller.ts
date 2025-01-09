import { controller, get, post, put, del, use, validate, Request, createStore } from '@zap-rs/core';
import chalk from 'chalk';

const log = {
  info: (msg: string, meta?: any) => console.log(chalk.blue(`ℹ️  ${msg}`), meta ? chalk.gray(JSON.stringify(meta, null, 2)) : ''),
  success: (msg: string, meta?: any) => console.log(chalk.green(`✅ ${msg}`), meta ? chalk.gray(JSON.stringify(meta, null, 2)) : ''),
  warn: (msg: string, meta?: any) => console.log(chalk.yellow(`⚠️  ${msg}`), meta ? chalk.gray(JSON.stringify(meta, null, 2)) : ''),
  error: (msg: string, meta?: any) => console.log(chalk.red(`❌ ${msg}`), meta ? chalk.gray(JSON.stringify(meta, null, 2)) : ''),
  debug: (msg: string, meta?: any) => console.log(chalk.magenta(`🔍 ${msg}`), meta ? chalk.gray(JSON.stringify(meta, null, 2)) : ''),
  http: (msg: string, meta?: any) => console.log(chalk.cyan(`🌐 ${msg}`), meta ? chalk.gray(JSON.stringify(meta, null, 2)) : '')
};

// Example middleware
const logMiddleware = async (req: Request, next: () => Promise<any>) => {
  log.debug(`🔄 Controller middleware: ${req.method} ${req.url}`);
  const result = await next();
  log.debug('🔄 Controller middleware completed');
  return result;
};

// Example validation schema
const userSchema = {
  type: 'object' as const,
  properties: {
    name: { type: 'string' as const, minLength: 3 },
    email: { type: 'string' as const, format: 'email' },
    age: { type: 'number' as const, minimum: 0 }
  },
  required: ['name', 'email']
};

@controller('/api')
@use(logMiddleware)
export class TestController {
  private store = createStore();

  @get('/hello')
  async hello() {
    log.debug('📨 Handling hello request');
    return { message: 'Hello from Zap!' };
  }

  @get('/echo')
  async echo(req: Request) {
    log.debug('📨 Handling echo request', { 
      method: req.method,
      url: req.url,
      headers: req.headers,
      query: req.query
    });
    return {
      method: req.method,
      url: req.url,
      headers: req.headers,
      query: req.query
    };
  }

  @post('/users')
  @validate(userSchema)
  async createUser(req: Request) {
    log.debug('📨 Creating new user', { body: req.body });
    
    // Store the user in our Rust-based store
    const userId = `user:${Date.now()}`;
    await this.store.set(userId, req.body);
    log.success('User created successfully', { userId });
    
    return {
      message: 'User created successfully',
      userId,
      data: req.body
    };
  }

  @get('/users/:id')
  async getUser(req: Request) {
    const userId = req.params?.id;
    log.debug('📨 Fetching user', { userId });

    if (!userId) {
      log.error('User ID is required');
      throw new Error('User ID is required');
    }

    const user = await this.store.get(`user:${userId}`);
    if (!user) {
      log.error('User not found', { userId });
      throw new Error('User not found');
    }

    log.success('User retrieved successfully', { userId });
    return { user };
  }

  @put('/users/:id')
  @validate(userSchema)
  async updateUser(req: Request) {
    const userId = req.params?.id;
    log.debug('📨 Updating user', { userId, body: req.body });

    if (!userId) {
      log.error('User ID is required');
      throw new Error('User ID is required');
    }

    await this.store.set(`user:${userId}`, req.body);
    log.success('User updated successfully', { userId });
    
    return {
      message: 'User updated successfully',
      data: req.body
    };
  }

  @del('/users/:id')
  async deleteUser(req: Request) {
    const userId = req.params?.id;
    log.debug('📨 Deleting user', { userId });

    if (!userId) {
      log.error('User ID is required');
      throw new Error('User ID is required');
    }

    await this.store.delete(`user:${userId}`);
    log.success('User deleted successfully', { userId });
    
    return {
      message: 'User deleted successfully'
    };
  }

  @get('/error')
  async error() {
    log.debug('📨 Testing error handling');
    log.error('Simulated error thrown');
    throw new Error('Test error handling');
  }

  @get('/store/clear')
  async clearStore() {
    log.debug('📨 Clearing store');
    await this.store.clear();
    log.success('Store cleared successfully');
    return {
      message: 'Store cleared successfully'
    };
  }
} 