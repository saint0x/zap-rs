import 'reflect-metadata';
import type { JsRequest, JsResponse } from '../src/types';
import { zap } from '../src/decorators';

// Mock implementation
class MockNativeRouter {
  private routes = new Map<number, { method: string; path: string; config?: any }>();
  private nextId = 1;
  private middlewares = new Map<number, Function>();

  async register(method: string, path: string, config?: any): Promise<number> {
    const id = this.nextId++;
    this.routes.set(id, { method, path, config });
    return id;
  }

  async registerMiddleware(middleware: Function): Promise<number> {
    const id = this.nextId++;
    this.middlewares.set(id, middleware);
    return id;
  }

  async getHandlerInfo(method: string, uri: string): Promise<[number, any] | null> {
    for (const [id, route] of this.routes.entries()) {
      if (route.method === method && this.matchPath(route.path, uri)) {
        const params = this.extractParams(route.path, uri);
        return [id, { params }];
      }
    }
    return null;
  }

  async getGuards(id: number): Promise<Function[]> {
    const route = this.routes.get(id);
    return route?.config?.guards || [];
  }

  async getMiddlewareChain(id: number): Promise<Function[]> {
    const route = this.routes.get(id);
    return route?.config?.middleware || [];
  }

  async getValidation(id: number): Promise<Function | null> {
    const route = this.routes.get(id);
    return route?.config?.validation || null;
  }

  async getTransform(id: number): Promise<Function | null> {
    const route = this.routes.get(id);
    return route?.config?.transform || null;
  }

  private matchPath(pattern: string, uri: string): boolean {
    const patternParts = pattern.split('/');
    const uriParts = uri.split('/');
    
    if (patternParts.length !== uriParts.length) return false;
    
    return patternParts.every((part, i) => {
      if (part.startsWith(':')) return true;
      return part === uriParts[i];
    });
  }

  private extractParams(pattern: string, uri: string): Record<string, string> {
    const params: Record<string, string> = {};
    const patternParts = pattern.split('/');
    const uriParts = uri.split('/');
    
    patternParts.forEach((part, i) => {
      if (part.startsWith(':')) {
        const paramName = part.slice(1);
        params[paramName] = uriParts[i];
      }
    });
    
    return params;
  }
}

class MockHooks {
  constructor() {}
}

// Mock the zap-napi module
jest.mock('zap-napi', () => ({
  Router: jest.fn().mockImplementation(() => new MockNativeRouter()),
  Hooks: jest.fn().mockImplementation(() => new MockHooks())
}));

// Test suite
describe('Router Integration Tests', () => {
  let router: any;
  let controller: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    router = new MockNativeRouter();

    @zap.controller('/api')
    class TestController {
      @zap.get('/test')
      async getTest(request: JsRequest): Promise<JsResponse> {
        return {
          status: 200,
          headers: {},
          body: { message: 'Hello' }
        };
      }

      @zap.post('/test')
      async postTest(request: JsRequest): Promise<JsResponse> {
        return {
          status: 200,
          headers: {},
          body: request.body
        };
      }

      @zap.get('/protected')
      @zap.guard(async (request: JsRequest) => request.headers['x-auth'] === 'secret')
      async getProtected(request: JsRequest): Promise<JsResponse> {
        return {
          status: 200,
          headers: {},
          body: { message: 'Protected' }
        };
      }

      @zap.post('/validated')
      @zap.validate(async (data: any) => {
        if (!data.name) {
          throw new Error('Name is required');
        }
        return data;
      })
      async postValidated(request: JsRequest): Promise<JsResponse> {
        return {
          status: 200,
          headers: {},
          body: request.body
        };
      }

      @zap.get('/transformed')
      @zap.transform(async (data: any) => {
        return { ...data, transformed: true };
      })
      async getTransformed(request: JsRequest): Promise<JsResponse> {
        return {
          status: 200,
          headers: {},
          body: { message: 'Original' }
        };
      }

      @zap.get('/middleware')
      @zap.use(async (request: JsRequest, next: () => Promise<void>) => {
        request.headers['x-middleware'] = 'applied';
        await next();
      })
      async getMiddleware(request: JsRequest): Promise<JsResponse> {
        return {
          status: 200,
          headers: {},
          body: { middleware: request.headers['x-middleware'] }
        };
      }

      @zap.get('/params/:id')
      async getParams(request: JsRequest): Promise<JsResponse> {
        return {
          status: 200,
          headers: {},
          body: { id: request.params.id }
        };
      }

      @zap.get('/query')
      async getQuery(request: JsRequest): Promise<JsResponse> {
        return {
          status: 200,
          headers: {},
          body: { query: request.query }
        };
      }

      @zap.get('/redirect')
      async getRedirect(request: JsRequest): Promise<JsResponse> {
        return {
          status: 302,
          headers: { location: '/new-location' },
          body: null
        };
      }
    }

    controller = new TestController();
    await router.registerController(controller);
  });

  it('should handle basic GET route', async () => {
    const request: JsRequest = {
      method: 'GET',
      uri: '/api/test',
      headers: {},
      body: null,
      params: {},
      query: {}
    };

    const response = await router.handle(request);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'Hello' });
  });

  it('should handle POST route with body', async () => {
    const request: JsRequest = {
      method: 'POST',
      uri: '/api/test',
      headers: {},
      body: { data: 'test' },
      params: {},
      query: {}
    };

    const response = await router.handle(request);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: 'test' });
  });

  it('should handle protected route with valid auth', async () => {
    const request: JsRequest = {
      method: 'GET',
      uri: '/api/protected',
      headers: { 'x-auth': 'secret' },
      body: null,
      params: {},
      query: {}
    };

    const response = await router.handle(request);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'Protected' });
  });

  it('should reject protected route with invalid auth', async () => {
    const request: JsRequest = {
      method: 'GET',
      uri: '/api/protected',
      headers: { 'x-auth': 'wrong' },
      body: null,
      params: {},
      query: {}
    };

    const response = await router.handle(request);
    expect(response.status).toBe(403);
  });

  it('should handle validation', async () => {
    const request: JsRequest = {
      method: 'POST',
      uri: '/api/validated',
      headers: {},
      body: { name: 'test' },
      params: {},
      query: {}
    };

    const response = await router.handle(request);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ name: 'test' });
  });

  it('should reject invalid data', async () => {
    const request: JsRequest = {
      method: 'POST',
      uri: '/api/validated',
      headers: {},
      body: {},
      params: {},
      query: {}
    };

    const response = await router.handle(request);
    expect(response.status).toBe(400);
  });

  it('should apply transformation', async () => {
    const request: JsRequest = {
      method: 'GET',
      uri: '/api/transformed',
      headers: {},
      body: null,
      params: {},
      query: {}
    };

    const response = await router.handle(request);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'Original', transformed: true });
  });

  it('should apply middleware', async () => {
    const request: JsRequest = {
      method: 'GET',
      uri: '/api/middleware',
      headers: {},
      body: null,
      params: {},
      query: {}
    };

    const response = await router.handle(request);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ middleware: 'applied' });
  });

  it('should handle route parameters', async () => {
    const request: JsRequest = {
      method: 'GET',
      uri: '/api/params/123',
      headers: {},
      body: null,
      params: {},
      query: {}
    };

    const response = await router.handle(request);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: '123' });
  });

  it('should handle query parameters', async () => {
    const request: JsRequest = {
      method: 'GET',
      uri: '/api/query?name=test',
      headers: {},
      body: null,
      params: {},
      query: { name: 'test' }
    };

    const response = await router.handle(request);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ query: { name: 'test' } });
  });

  it('should handle redirects', async () => {
    const request: JsRequest = {
      method: 'GET',
      uri: '/api/redirect',
      headers: {},
      body: null,
      params: {},
      query: {}
    };

    const response = await router.handle(request);
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/new-location');
  });
}); 