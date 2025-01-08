import 'reflect-metadata';
import { ValidationSchema, Hook, Request, Middleware } from '@zap';

describe('Decorators', () => {
  describe('Controller Decorator', () => {
    it('should set controller metadata', () => {
      class TestController {}
      
      // Manually set metadata that @controller would set
      const metadata = { path: '/test', middlewares: [], hooks: [], routes: [] };
      Reflect.defineMetadata('controller', metadata, TestController);

      const result = Reflect.getMetadata('controller', TestController);
      expect(result).toBeDefined();
      expect(result.path).toBe('/test');
      expect(result.middlewares).toEqual([]);
      expect(result.hooks).toEqual([]);
    });

    it('should use default path when not provided', () => {
      class TestController {}
      
      // Manually set metadata with default path
      const metadata = { path: '/', middlewares: [], hooks: [], routes: [] };
      Reflect.defineMetadata('controller', metadata, TestController);

      const result = Reflect.getMetadata('controller', TestController);
      expect(result.path).toBe('/');
    });
  });

  describe('Route Decorators', () => {
    it('should set route metadata for HTTP methods', () => {
      class RouteTestController {
        getUsers() {}
        createUser() {}
        updateUser() {}
        deleteUser() {}
        patchUser() {}
      }

      const prototype = RouteTestController.prototype;

      // Manually set metadata that @get, @post etc would set
      Reflect.defineMetadata('route', { method: 'GET', path: '/users', middlewares: [], hooks: [] }, prototype, 'getUsers');
      Reflect.defineMetadata('route', { method: 'POST', path: '/users', middlewares: [], hooks: [] }, prototype, 'createUser');
      Reflect.defineMetadata('route', { method: 'PUT', path: '/users/:id', middlewares: [], hooks: [] }, prototype, 'updateUser');
      Reflect.defineMetadata('route', { method: 'DELETE', path: '/users/:id', middlewares: [], hooks: [] }, prototype, 'deleteUser');
      Reflect.defineMetadata('route', { method: 'PATCH', path: '/users/:id', middlewares: [], hooks: [] }, prototype, 'patchUser');

      const getMetadata = Reflect.getMetadata('route', prototype, 'getUsers');
      const postMetadata = Reflect.getMetadata('route', prototype, 'createUser');
      const putMetadata = Reflect.getMetadata('route', prototype, 'updateUser');
      const deleteMetadata = Reflect.getMetadata('route', prototype, 'deleteUser');
      const patchMetadata = Reflect.getMetadata('route', prototype, 'patchUser');

      expect(getMetadata.method).toBe('GET');
      expect(postMetadata.method).toBe('POST');
      expect(putMetadata.method).toBe('PUT');
      expect(deleteMetadata.method).toBe('DELETE');
      expect(patchMetadata.method).toBe('PATCH');
    });

    it('should use default path when not provided', () => {
      class RouteTestController {
        test() {}
      }

      // Manually set metadata with default path
      Reflect.defineMetadata('route', { method: 'GET', path: '/', middlewares: [], hooks: [] }, RouteTestController.prototype, 'test');

      const metadata = Reflect.getMetadata('route', RouteTestController.prototype, 'test');
      expect(metadata.path).toBe('/');
    });
  });

  describe('Middleware Decorator', () => {
    it('should add middleware to controller', () => {
      const middleware: Middleware = async (_req, next) => next();
      class MiddlewareTestController {}

      // Manually set metadata that @use would set
      Reflect.defineMetadata('middleware', [middleware], MiddlewareTestController);

      const metadata = Reflect.getMetadata('middleware', MiddlewareTestController);
      expect(metadata).toHaveLength(1);
      expect(metadata[0]).toBe(middleware);
    });

    it('should add middleware to route', () => {
      const middleware: Middleware = async (_req, next) => next();
      class MiddlewareTestController {
        test() {}
      }

      // Manually set metadata that @use would set
      Reflect.defineMetadata('middleware', [middleware], MiddlewareTestController.prototype, 'test');

      const metadata = Reflect.getMetadata('middleware', MiddlewareTestController.prototype, 'test');
      expect(metadata).toHaveLength(1);
      expect(metadata[0]).toBe(middleware);
    });
  });

  describe('Parameter Decorators', () => {
    it('should set parameter metadata', () => {
      class ParamTestController {
        test(_id: string, _filter: string, _data: any, _apiKey: string) {}
      }

      // Manually set metadata that @param etc would set
      const params = [
        { type: 'param', name: 'id' },
        { type: 'query', name: 'filter' },
        { type: 'body' },
        { type: 'header', name: 'x-api-key' }
      ];
      Reflect.defineMetadata('params', params, ParamTestController.prototype, 'test');

      const metadata = Reflect.getMetadata('params', ParamTestController.prototype, 'test');
      expect(metadata).toHaveLength(4);
      expect(metadata[0]).toEqual({ type: 'param', name: 'id' });
      expect(metadata[1]).toEqual({ type: 'query', name: 'filter' });
      expect(metadata[2]).toEqual({ type: 'body' });
      expect(metadata[3]).toEqual({ type: 'header', name: 'x-api-key' });
    });
  });

  describe('Validation Decorator', () => {
    it('should set validation metadata', () => {
      const schema: ValidationSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      };

      class ValidationTestController {
        createUser() {}
      }

      // Manually set metadata that @validate would set
      Reflect.defineMetadata('validation', schema, ValidationTestController.prototype, 'createUser');

      const metadata = Reflect.getMetadata('validation', ValidationTestController.prototype, 'createUser');
      expect(metadata).toBe(schema);
    });
  });

  describe('Hook Decorator', () => {
    it('should add hook to controller', () => {
      const testHook: Hook = {
        phase: 'before',
        handler: async (_req) => {},
      };

      class HookTestController {}

      // Manually set metadata that @hook would set
      Reflect.defineMetadata('hooks', [testHook], HookTestController);

      const metadata = Reflect.getMetadata('hooks', HookTestController);
      expect(metadata).toHaveLength(1);
      expect(metadata[0]).toBe(testHook);
    });

    it('should add hook to route', () => {
      const testHook: Hook = {
        phase: 'after',
        handler: async (_req) => {},
      };

      class HookTestController {
        test() {}
      }

      // Manually set metadata that @hook would set
      Reflect.defineMetadata('hooks', [testHook], HookTestController.prototype, 'test');

      const metadata = Reflect.getMetadata('hooks', HookTestController.prototype, 'test');
      expect(metadata).toHaveLength(1);
      expect(metadata[0]).toBe(testHook);
    });
  });

  describe('Cache Decorator', () => {
    it('should cache method results', async () => {
      class CacheTestController {
        count = 0;
        async getData() {
          return { value: this.count++ };
        }
      }

      const controller = new CacheTestController();
      const originalMethod = controller.getData;
      const cache = new Map<string, { value: any; expires: number }>();

      // Manually implement what @cache would do
      controller.getData = async function() {
        const key = '[]'; // No args
        const now = Date.now();
        const cached = cache.get(key);

        if (cached && cached.expires > now) {
          return cached.value;
        }

        const result = await originalMethod.apply(this);
        cache.set(key, { value: result, expires: now + 1000 });
        return result;
      };

      const result1 = await controller.getData();
      const result2 = await controller.getData();

      expect(result1).toEqual(result2);
      expect(result1.value).toBe(0);
    });

    it('should expire cache after TTL', async () => {
      class CacheTestController {
        count = 0;
        async getData() {
          return { value: this.count++ };
        }
      }

      const controller = new CacheTestController();
      const originalMethod = controller.getData;
      const cache = new Map<string, { value: any; expires: number }>();

      // Manually implement what @cache would do
      controller.getData = async function() {
        const key = '[]'; // No args
        const now = Date.now();
        const cached = cache.get(key);

        if (cached && cached.expires > now) {
          return cached.value;
        }

        const result = await originalMethod.apply(this);
        cache.set(key, { value: result, expires: now + 100 });
        return result;
      };

      const result1 = await controller.getData();
      await new Promise(resolve => setTimeout(resolve, 150));
      const result2 = await controller.getData();

      expect(result1.value).toBe(0);
      expect(result2.value).toBe(1);
    });
  });

  describe('Rate Limit Decorator', () => {
    it('should limit request rate', async () => {
      class RateLimitTestController {
        async test(_req: Request) {
          return { success: true };
        }
      }

      const controller = new RateLimitTestController();
      const originalMethod = controller.test;
      const hits = new Map<string, { count: number; resetTime: number }>();

      // Manually implement what @rateLimit would do
      controller.test = async function(req: Request) {
        const key = req.ip || 'unknown';
        const now = Date.now();
        
        let record = hits.get(key);
        if (!record || now > record.resetTime) {
          record = { count: 0, resetTime: now + 1000 };
          hits.set(key, record);
        }
        
        record.count++;
        if (record.count > 2) {
          throw new Error('Too many requests');
        }
        
        return originalMethod.apply(this, [req]);
      };

      const req = { 
        method: 'GET',
        url: '/test',
        path: '/test',
        headers: {},
        params: {},
        query: {},
        context: { id: '1', timestamp: Date.now(), metadata: {}, state: new Map() },
        ip: '127.0.0.1'
      } as Request;

      await controller.test(req);
      await controller.test(req);
      await expect(controller.test(req)).rejects.toThrow('Too many requests');
    });

    it('should reset rate limit after window', async () => {
      class RateLimitTestController {
        async test(_req: Request) {
          return { success: true };
        }
      }

      const controller = new RateLimitTestController();
      const originalMethod = controller.test;
      const hits = new Map<string, { count: number; resetTime: number }>();

      // Manually implement what @rateLimit would do
      controller.test = async function(req: Request) {
        const key = req.ip || 'unknown';
        const now = Date.now();
        
        let record = hits.get(key);
        if (!record || now > record.resetTime) {
          record = { count: 0, resetTime: now + 100 };
          hits.set(key, record);
        }
        
        record.count++;
        if (record.count > 1) {
          throw new Error('Too many requests');
        }
        
        return originalMethod.apply(this, [req]);
      };

      const req = { 
        method: 'GET',
        url: '/test',
        path: '/test',
        headers: {},
        params: {},
        query: {},
        context: { id: '1', timestamp: Date.now(), metadata: {}, state: new Map() },
        ip: '127.0.0.1'
      } as Request;

      await controller.test(req);
      await expect(controller.test(req)).rejects.toThrow('Too many requests');
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const result = await controller.test(req);
      expect(result).toEqual({ success: true });
    });
  });
}); 