import 'reflect-metadata';
import {
  Router,
  createRouter,
  Request,
  Response,
  ValidationSchema,
  RouterError,
  createLogger,
  createRequestLogger,
  createBodyParserMiddleware,
  createCorsMiddleware,
  createAuthMiddleware,
  createRateLimitMiddleware,
  controller,
  get,
  post,
  use,
  validate
} from '@zap';

describe('NAPI Integration', () => {
  let router: Router;

  beforeEach(() => {
    router = createRouter({
      enableLogging: true,
      logLevel: 'debug',
    });
  });

  describe('Basic Routing', () => {
    it('should handle basic routes with controllers', async () => {
      @controller('/api')
      class TestController {
        @get('/hello')
        async hello() {
          return { message: 'Hello, World!' };
        }

        @post('/echo')
        async echo(req: Request) {
          return req.body;
        }
      }

      router.registerController(new TestController());

      const getResponse = await router.handleRequest({
        method: 'GET',
        url: '/api/hello',
        path: '/api/hello',
        headers: {},
        params: {},
        query: {},
        context: { id: '1', timestamp: Date.now(), metadata: {}, state: new Map() },
      });

      expect(getResponse.status).toBe(200);
      expect(getResponse.body).toEqual({ message: 'Hello, World!' });

      const postResponse = await router.handleRequest({
        method: 'POST',
        url: '/api/echo',
        path: '/api/echo',
        headers: { 'content-type': 'application/json' },
        body: { test: 'data' },
        params: {},
        query: {},
        context: { id: '2', timestamp: Date.now(), metadata: {}, state: new Map() },
      });

      expect(postResponse.status).toBe(200);
      expect(postResponse.body).toEqual({ test: 'data' });
    });
  });

  describe('Middleware Integration', () => {
    it('should apply middleware in correct order', async () => {
      const order: string[] = [];

      const middleware1 = async (_req: Request, next: () => Promise<Response>) => {
        order.push('middleware1:before');
        const response = await next();
        order.push('middleware1:after');
        return response;
      };

      const middleware2 = async (_req: Request, next: () => Promise<Response>) => {
        order.push('middleware2:before');
        const response = await next();
        order.push('middleware2:after');
        return response;
      };

      @controller('/api')
      @use(middleware1)
      class MiddlewareTestController {
        @get('/test')
        @use(middleware2)
        async test() {
          order.push('handler');
          return { message: 'ok' };
        }
      }

      router.registerController(new MiddlewareTestController());

      await router.handleRequest({
        method: 'GET',
        url: '/api/test',
        path: '/api/test',
        headers: {},
        params: {},
        query: {},
        context: { id: '1', timestamp: Date.now(), metadata: {}, state: new Map() },
      });

      expect(order).toEqual([
        'middleware1:before',
        'middleware2:before',
        'handler',
        'middleware2:after',
        'middleware1:after',
      ]);
    });
  });

  describe('Validation Integration', () => {
    it('should validate request data', async () => {
      const schema: ValidationSchema = {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 3 },
          age: { type: 'number', minimum: 0 },
        },
        required: ['name', 'age'],
      };

      @controller('/api')
      class ValidationTestController {
        @post('/user')
        @validate(schema)
        async createUser(req: Request) {
          return req.body;
        }
      }

      router.registerController(new ValidationTestController());

      // Valid data
      const validResponse = await router.handleRequest({
        method: 'POST',
        url: '/api/user',
        path: '/api/user',
        headers: { 'content-type': 'application/json' },
        body: { name: 'John', age: 25 },
        params: {},
        query: {},
        context: { id: '1', timestamp: Date.now(), metadata: {}, state: new Map() },
      });

      expect(validResponse.status).toBe(200);
      expect(validResponse.body).toEqual({ name: 'John', age: 25 });

      // Invalid data
      try {
        await router.handleRequest({
          method: 'POST',
          url: '/api/user',
          path: '/api/user',
          headers: { 'content-type': 'application/json' },
          body: { name: 'Jo', age: -1 },
          params: {},
          query: {},
          context: { id: '2', timestamp: Date.now(), metadata: {}, state: new Map() },
        });
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error instanceof RouterError).toBe(true);
        expect((error as RouterError).code).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle errors properly', async () => {
      @controller('/api')
      class ErrorTestController {
        @get('/error')
        async throwError() {
          throw new Error('Test error');
        }
      }

      router.registerController(new ErrorTestController());

      const response = await router.handleRequest({
        method: 'GET',
        url: '/api/error',
        path: '/api/error',
        headers: {},
        params: {},
        query: {},
        context: { id: '1', timestamp: Date.now(), metadata: {}, state: new Map() },
      });

      expect(response.status).toBe(500);
      expect((response.body as any).error).toBeDefined();
      expect((response.body as any).error.message).toBe('Test error');
    });
  });

  describe('Built-in Middleware', () => {
    it('should work with built-in middleware', async () => {
      const logger = createLogger();
      const requestLogger = createRequestLogger(logger);
      const bodyParser = createBodyParserMiddleware();
      const cors = createCorsMiddleware({
        origin: '*',
        methods: ['GET', 'POST'],
      });
      const auth = createAuthMiddleware({
        authenticate: async (req) => {
          return req.headers['authorization'] === 'Bearer test';
        },
      });
      const rateLimit = createRateLimitMiddleware({
        windowMs: 1000,
        max: 2,
      });

      router.use(requestLogger);
      router.use(bodyParser);
      router.use(cors);
      router.use(auth);
      router.use(rateLimit);

      @controller('/api')
      class MiddlewareTestController {
        @get('/test')
        async test() {
          return { message: 'success' };
        }
      }

      router.registerController(new MiddlewareTestController());

      // Test CORS
      const corsResponse = await router.handleRequest({
        method: 'OPTIONS',
        url: '/api/test',
        path: '/api/test',
        headers: {},
        params: {},
        query: {},
        context: { id: '1', timestamp: Date.now(), metadata: {}, state: new Map() },
      });

      expect(corsResponse.status).toBe(204);
      expect(corsResponse.headers['Access-Control-Allow-Origin']).toBe('*');

      // Test Auth
      try {
        await router.handleRequest({
          method: 'GET',
          url: '/api/test',
          path: '/api/test',
          headers: {},
          params: {},
          query: {},
          context: { id: '2', timestamp: Date.now(), metadata: {}, state: new Map() },
        });
        fail('Should have thrown auth error');
      } catch (error) {
        expect(error instanceof RouterError).toBe(true);
        expect((error as RouterError).code).toBe('UNAUTHORIZED');
      }

      // Test successful request
      const response = await router.handleRequest({
        method: 'GET',
        url: '/api/test',
        path: '/api/test',
        headers: { 'authorization': 'Bearer test' },
        params: {},
        query: {},
        context: { id: '3', timestamp: Date.now(), metadata: {}, state: new Map() },
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'success' });
    });
  });
}); 