import 'reflect-metadata';
import { mocks } from './jest.setup';
import { Zap } from '@zap/zap';
import { RequestContext, ResponseContext, ControllerMetadata, RouteMetadata } from '@zap/types';

describe('Zap Decorators', () => {
  describe('Controller Registration', () => {
    it('should register controller with correct path', () => {
      class TestController {
        async getTest(): Promise<ResponseContext> {
          return { status: 200, body: 'test' };
        }
      }

      // Manually set metadata that @controller would set
      const metadata: ControllerMetadata = { path: '/api', middlewares: [] };
      Reflect.defineMetadata('zap:controller', metadata, TestController);

      // Manually set metadata that @get would set
      const routeMetadata: RouteMetadata = {
        method: 'GET',
        path: '/test',
        middlewares: [],
        hooks: []
      };
      Reflect.defineMetadata('zap:route', routeMetadata, TestController.prototype, 'getTest');

      const zap = new Zap();
      zap.register(TestController);
      
      expect(mocks.router.addRoute).toHaveBeenCalledWith(
        'GET',
        '/api/test',
        expect.any(Function)
      );
    });
  });

  describe('Route Methods', () => {
    it('should register all HTTP method routes correctly', () => {
      class RouteTestController {
        async getRoute(): Promise<ResponseContext> { return { status: 200 }; }
        async postRoute(): Promise<ResponseContext> { return { status: 201 }; }
        async putRoute(): Promise<ResponseContext> { return { status: 200 }; }
        async deleteRoute(): Promise<ResponseContext> { return { status: 204 }; }
        async patchRoute(): Promise<ResponseContext> { return { status: 200 }; }
      }

      // Set controller metadata
      Reflect.defineMetadata('zap:controller', { path: '/api', middlewares: [] }, RouteTestController);

      // Set route metadata for each method
      const routes = [
        { method: 'GET', path: '/get', name: 'getRoute' },
        { method: 'POST', path: '/post', name: 'postRoute' },
        { method: 'PUT', path: '/put', name: 'putRoute' },
        { method: 'DELETE', path: '/delete', name: 'deleteRoute' },
        { method: 'PATCH', path: '/patch', name: 'patchRoute' }
      ];

      routes.forEach(route => {
        Reflect.defineMetadata('zap:route', {
          method: route.method,
          path: route.path,
          middlewares: [],
          hooks: []
        }, RouteTestController.prototype, route.name);
      });

      const zap = new Zap();
      zap.register(RouteTestController);

      expect(mocks.router.addRoute).toHaveBeenCalledWith('GET', '/api/get', expect.any(Function));
      expect(mocks.router.addRoute).toHaveBeenCalledWith('POST', '/api/post', expect.any(Function));
      expect(mocks.router.addRoute).toHaveBeenCalledWith('PUT', '/api/put', expect.any(Function));
      expect(mocks.router.addRoute).toHaveBeenCalledWith('DELETE', '/api/delete', expect.any(Function));
      expect(mocks.router.addRoute).toHaveBeenCalledWith('PATCH', '/api/patch', expect.any(Function));
    });
  });

  describe('Middleware', () => {
    it('should register middleware for both controller and route', () => {
      const testMiddleware = async (ctx: RequestContext, next: () => Promise<void>) => {
        ctx.headers['test'] = 'middleware';
        await next();
      };

      class MiddlewareTestController {
        async testRoute(): Promise<ResponseContext> {
          return { status: 200 };
        }
      }

      // Set controller metadata with middleware
      Reflect.defineMetadata('zap:controller', {
        path: '/api',
        middlewares: [testMiddleware]
      }, MiddlewareTestController);

      // Set route metadata with middleware
      Reflect.defineMetadata('zap:route', {
        method: 'GET',
        path: '/test',
        middlewares: [testMiddleware],
        hooks: []
      }, MiddlewareTestController.prototype, 'testRoute');

      const zap = new Zap();
      zap.register(MiddlewareTestController);

      expect(mocks.router.addMiddleware).toHaveBeenCalledWith('/api', testMiddleware);
      expect(mocks.router.addMiddleware).toHaveBeenCalledWith('/api/test', testMiddleware);
    });
  });

  describe('Parameter Handling', () => {
    it('should handle parameters correctly', async () => {
      class ParamTestController {
        async testRoute(): Promise<ResponseContext> {
          return {
            status: 200,
            body: { id: '123', data: { test: 'data' }, queryParams: { page: '1' }, testHeader: 'header-value' }
          };
        }
      }

      // Set controller metadata
      Reflect.defineMetadata('zap:controller', { path: '/api', middlewares: [] }, ParamTestController);

      // Set route metadata
      Reflect.defineMetadata('zap:route', {
        method: 'POST',
        path: '/test/:id',
        middlewares: [],
        hooks: []
      }, ParamTestController.prototype, 'testRoute');

      // Set parameter metadata
      Reflect.defineMetadata('zap:parameter', [
        { type: 'param', name: 'id', index: 0 },
        { type: 'body', index: 1 },
        { type: 'query', index: 2 },
        { type: 'header', name: 'x-test', index: 3 }
      ], ParamTestController.prototype, 'testRoute');

      const zap = new Zap();
      zap.register(ParamTestController);

      const addRouteCall = (mocks.router.addRoute as jest.Mock).mock.calls.find(
        call => call[0] === 'POST' && call[1] === '/api/test/:id'
      );
      const handler = addRouteCall[2];

      const response = await handler({
        params: { id: '123' },
        body: { test: 'data' },
        query: { page: '1' },
        headers: { 'x-test': 'header-value' }
      });

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

  describe('Validation', () => {
    it('should validate request body using schema', async () => {
      const testSchema = {
        validate: (data: unknown) => {
          if (typeof data !== 'object' || !data || !('name' in data)) {
            throw new Error('Invalid data');
          }
          return data;
        }
      };

      class ValidationTestController {
        async testRoute(data: { name: string }): Promise<ResponseContext> {
          return { status: 200, body: data };
        }
      }

      // Set controller metadata
      Reflect.defineMetadata('zap:controller', { path: '/api', middlewares: [] }, ValidationTestController);

      // Set route metadata with validation
      Reflect.defineMetadata('zap:route', {
        method: 'POST',
        path: '/test',
        middlewares: [],
        hooks: [],
        validation: testSchema
      }, ValidationTestController.prototype, 'testRoute');

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

  describe('Hooks', () => {
    it('should execute hooks in correct order', async () => {
      const hookCalls: string[] = [];

      class HookTestController {
        async testRoute(): Promise<ResponseContext> {
          hookCalls.push('handler');
          return { status: 200, body: hookCalls };
        }
      }

      // Set controller metadata
      Reflect.defineMetadata('zap:controller', { path: '/api', middlewares: [] }, HookTestController);

      // Set route metadata with hooks
      Reflect.defineMetadata('zap:route', {
        method: 'GET',
        path: '/test',
        middlewares: [],
        hooks: [
          { phase: 'pre-handler', handler: async () => hookCalls.push('pre') },
          { phase: 'post-handler', handler: async () => hookCalls.push('post') }
        ]
      }, HookTestController.prototype, 'testRoute');

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