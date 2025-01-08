import { mocks } from './jest.setup';
import { Zap, controller, get, post, put, del, patch, use, body, query, param, header, validate, hook } from '../src/zap';
import { RequestContext, ResponseContext } from '../src/types';

describe('Zap Decorators', () => {
  describe('Controller Decorator', () => {
    @controller('/api')
    class TestController {
      @get('/test')
      async getTest(): Promise<ResponseContext> {
        return { status: 200, body: 'test' };
      }
    }

    it('should register controller with correct path', () => {
      const zap = new Zap();
      zap.register(TestController);
      
      expect(mocks.router.addRoute).toHaveBeenCalledWith(
        'GET',
        '/api/test',
        expect.any(Function)
      );
    });
  });

  describe('Route Decorators', () => {
    @controller('/api')
    class RouteTestController {
      @get('/get')
      async getRoute(): Promise<ResponseContext> {
        return { status: 200 };
      }

      @post('/post')
      async postRoute(): Promise<ResponseContext> {
        return { status: 201 };
      }

      @put('/put')
      async putRoute(): Promise<ResponseContext> {
        return { status: 200 };
      }

      @del('/delete')
      async deleteRoute(): Promise<ResponseContext> {
        return { status: 204 };
      }

      @patch('/patch')
      async patchRoute(): Promise<ResponseContext> {
        return { status: 200 };
      }
    }

    it('should register all HTTP method routes correctly', () => {
      const zap = new Zap();
      zap.register(RouteTestController);

      expect(mocks.router.addRoute).toHaveBeenCalledWith('GET', '/api/get', expect.any(Function));
      expect(mocks.router.addRoute).toHaveBeenCalledWith('POST', '/api/post', expect.any(Function));
      expect(mocks.router.addRoute).toHaveBeenCalledWith('PUT', '/api/put', expect.any(Function));
      expect(mocks.router.addRoute).toHaveBeenCalledWith('DELETE', '/api/delete', expect.any(Function));
      expect(mocks.router.addRoute).toHaveBeenCalledWith('PATCH', '/api/patch', expect.any(Function));
    });
  });

  describe('Middleware Decorator', () => {
    const testMiddleware = async (ctx: RequestContext, next: () => Promise<void>) => {
      ctx.headers['test'] = 'middleware';
      await next();
    };

    @controller('/api')
    @use(testMiddleware)
    class MiddlewareTestController {
      @get('/test')
      @use(testMiddleware)
      async testRoute(): Promise<ResponseContext> {
        return { status: 200 };
      }
    }

    it('should register middleware for both controller and route', () => {
      const zap = new Zap();
      zap.register(MiddlewareTestController);

      expect(mocks.router.addMiddleware).toHaveBeenCalledWith('/api', testMiddleware);
      expect(mocks.router.addMiddleware).toHaveBeenCalledWith('/api/test', testMiddleware);
    });
  });

  describe('Parameter Decorators', () => {
    @controller('/api')
    class ParamTestController {
      @post('/test/:id')
      async testRoute(
        @param('id') id: string,
        @body() data: any,
        @query() queryParams: any,
        @header('x-test') testHeader: string
      ): Promise<ResponseContext> {
        return {
          status: 200,
          body: { id, data, queryParams, testHeader }
        };
      }
    }

    it('should handle parameter decorators correctly', async () => {
      const zap = new Zap();
      zap.register(ParamTestController);

      const testContext: RequestContext = {
        params: { id: '123' },
        body: { test: 'data' },
        query: { page: '1' },
        headers: { 'x-test': 'header-value' }
      };

      // Get the route handler that was registered
      const addRouteCall = (mocks.router.addRoute as jest.Mock).mock.calls.find(
        call => call[0] === 'POST' && call[1] === '/api/test/:id'
      );
      const handler = addRouteCall[2];

      // Call the handler with our test context
      const response = await handler(testContext);

      expect(response).toEqual({
        status: 200,
        body: {
          id: '123',
          data: { test: 'data' },
          queryParams: { page: '1' },
          testHeader: 'header-value'
        }
      });
    });
  });

  describe('Validation Decorator', () => {
    const testSchema = {
      validate: (data: unknown) => {
        if (typeof data !== 'object' || !data || !('name' in data)) {
          throw new Error('Invalid data');
        }
        return data;
      }
    };

    @controller('/api')
    class ValidationTestController {
      @post('/test')
      @validate(testSchema)
      async testRoute(@body() data: { name: string }): Promise<ResponseContext> {
        return { status: 200, body: data };
      }
    }

    it('should validate request body using schema', async () => {
      const zap = new Zap();
      zap.register(ValidationTestController);

      const addRouteCall = (mocks.router.addRoute as jest.Mock).mock.calls.find(
        call => call[0] === 'POST' && call[1] === '/api/test'
      );
      const handler = addRouteCall[2];

      // Valid data
      const validResponse = await handler({
        params: {},
        query: {},
        headers: {},
        body: { name: 'test' }
      });
      expect(validResponse.status).toBe(200);

      // Invalid data should throw
      await expect(handler({
        params: {},
        query: {},
        headers: {},
        body: {}
      })).rejects.toThrow('Invalid data');
    });
  });

  describe('Hook Decorator', () => {
    @controller('/api')
    class HookTestController {
      private hookCalls: string[] = [];

      @get('/test')
      @hook('pre-handler')
      async preHandler(ctx: RequestContext) {
        this.hookCalls.push('pre');
      }

      @hook('post-handler')
      async postHandler(ctx: RequestContext) {
        this.hookCalls.push('post');
      }

      async testRoute(): Promise<ResponseContext> {
        this.hookCalls.push('handler');
        return { status: 200, body: this.hookCalls };
      }
    }

    it('should execute hooks in correct order', async () => {
      const zap = new Zap();
      zap.register(HookTestController);

      const addRouteCall = (mocks.router.addRoute as jest.Mock).mock.calls.find(
        call => call[0] === 'GET' && call[1] === '/api/test'
      );
      const handler = addRouteCall[2];

      const response = await handler({
        params: {},
        query: {},
        headers: {},
        body: null
      });

      expect(response.body).toEqual(['pre', 'handler', 'post']);
    });
  });
}); 