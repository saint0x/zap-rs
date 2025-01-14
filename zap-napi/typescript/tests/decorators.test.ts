import { zap } from '../src/public';

describe('Decorators', () => {
  let router: zap.Router;

  beforeEach(() => {
    router = new zap.Router();
  });

  @zap.controller('/api')
  class TestController {
    router: zap.Router;

    constructor(router: zap.Router) {
      this.router = router;
    }

    @zap.get('/test')
    async testGet(request: zap.Request): Promise<zap.Response> {
      return zap.createResponse(200, {}, { message: 'GET success' });
    }

    @zap.post('/test')
    async testPost(request: zap.Request): Promise<zap.Response> {
      return zap.createResponse(200, {}, { message: 'POST success' });
    }

    @zap.put('/test')
    async testPut(request: zap.Request): Promise<zap.Response> {
      return zap.createResponse(200, {}, { message: 'PUT success' });
    }

    @zap.del('/test')
    async testDelete(request: zap.Request): Promise<zap.Response> {
      return zap.createResponse(200, {}, { message: 'DELETE success' });
    }

    @zap.get('/protected')
    @zap.guard(async (request: zap.Request) => request.headers['x-auth'] === 'secret')
    async protectedRoute(request: zap.Request): Promise<zap.Response> {
      return zap.createResponse(200, {}, { message: 'Protected route' });
    }

    @zap.post('/validated')
    @zap.validate(async (data: any) => {
      if (!data.name) {
        throw new Error('Name is required');
      }
      return data;
    })
    async validatedRoute(request: zap.Request): Promise<zap.Response> {
      return zap.createResponse(200, {}, { message: 'Validation passed', data: request.body });
    }

    @zap.get('/transformed')
    @zap.transform(async (data: any) => {
      return { ...data, transformed: true };
    })
    async transformedRoute(request: zap.Request): Promise<zap.Response> {
      return zap.createResponse(200, {}, { message: 'Original response' });
    }

    @zap.get('/middleware')
    @zap.use(async (request: zap.Request, next: () => Promise<void>) => {
      request.headers['x-middleware'] = 'applied';
      await next();
    })
    async middlewareRoute(request: zap.Request): Promise<zap.Response> {
      return zap.createResponse(200, {}, { message: 'Middleware applied' });
    }

    @zap.get('/params/:id')
    async paramsRoute(request: zap.Request): Promise<zap.Response> {
      return zap.createResponse(200, {}, { id: request.params?.id });
    }

    @zap.get('/query')
    async queryRoute(request: zap.Request): Promise<zap.Response> {
      return zap.createResponse(200, {}, { query: request.query });
    }

    @zap.get('/redirect')
    async redirectRoute(request: zap.Request): Promise<zap.Response> {
      return zap.createResponse(302, { 'Location': '/new-location' }, null, '/new-location');
    }
  }

  it('should handle GET requests', async () => {
    const controller = new TestController(router);
    const request = zap.createRequest('GET', '/api/test');
    const response = await router.handle(request);
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('GET success');
  });

  it('should handle POST requests', async () => {
    const controller = new TestController(router);
    const request = zap.createRequest('POST', '/api/test');
    const response = await router.handle(request);
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('POST success');
  });

  it('should handle PUT requests', async () => {
    const controller = new TestController(router);
    const request = zap.createRequest('PUT', '/api/test');
    const response = await router.handle(request);
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('PUT success');
  });

  it('should handle DELETE requests', async () => {
    const controller = new TestController(router);
    const request = zap.createRequest('DELETE', '/api/test');
    const response = await router.handle(request);
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('DELETE success');
  });

  it('should handle guards', async () => {
    const controller = new TestController(router);
    const request = zap.createRequest('GET', '/api/protected', { 'x-auth': 'secret' });
    const response = await router.handle(request);
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Protected route');

    const unauthorizedRequest = zap.createRequest('GET', '/api/protected');
    await expect(router.handle(unauthorizedRequest)).rejects.toThrow('Access denied by guard');
  });

  it('should handle validation', async () => {
    const controller = new TestController(router);
    const request = zap.createRequest('POST', '/api/validated', {}, { name: 'test' });
    const response = await router.handle(request);
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Validation passed');
    expect(response.body.data.name).toBe('test');

    const invalidRequest = zap.createRequest('POST', '/api/validated', {}, {});
    await expect(router.handle(invalidRequest)).rejects.toThrow('Name is required');
  });

  it('should handle transforms', async () => {
    const controller = new TestController(router);
    const request = zap.createRequest('GET', '/api/transformed');
    const response = await router.handle(request);
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Original response');
    expect(response.body.transformed).toBe(true);
  });

  it('should handle middleware', async () => {
    const controller = new TestController(router);
    const request = zap.createRequest('GET', '/api/middleware');
    const response = await router.handle(request);
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Middleware applied');
    expect(request.headers['x-middleware']).toBe('applied');
  });

  it('should handle route parameters', async () => {
    const controller = new TestController(router);
    const request = zap.createRequest('GET', '/api/params/123', {}, null, { id: '123' });
    const response = await router.handle(request);
    expect(response.status).toBe(200);
    expect(response.body.id).toBe('123');
  });

  it('should handle query parameters', async () => {
    const controller = new TestController(router);
    const request = zap.createRequest('GET', '/api/query', {}, null, {}, { page: '1', limit: '10' });
    const response = await router.handle(request);
    expect(response.status).toBe(200);
    expect(response.body.query).toEqual({ page: '1', limit: '10' });
  });

  it('should handle redirects', async () => {
    const controller = new TestController(router);
    const request = zap.createRequest('GET', '/api/redirect');
    const response = await router.handle(request);
    expect(response.status).toBe(302);
    expect(response.headers['Location']).toBe('/new-location');
    expect(response.redirect).toBe('/new-location');
  });
}); 