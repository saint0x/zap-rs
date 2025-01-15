import { Router } from '../src/router';
import { zap } from '../src/decorators';
import type { JsRequest, JsResponse } from '../src/types';
import 'reflect-metadata';

describe('Router Decorators', () => {
  let router: Router;
  let controller: any;

  beforeEach(async () => {
    router = new Router();
    
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

      @zap.put('/test')
      async putTest(request: JsRequest): Promise<JsResponse> {
        return {
          status: 200,
          headers: {},
          body: request.body
        };
      }

      @zap.del('/test')
      async deleteTest(request: JsRequest): Promise<JsResponse> {
        return {
          status: 200,
          headers: {},
          body: { deleted: true }
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
          headers: request.headers,
          body: { message: 'Middleware' }
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
          headers: { location: '/test' },
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

  it('should handle middleware', async () => {
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
    expect(response.headers['x-middleware']).toBe('applied');
  });

  it('should handle guards', async () => {
    const validRequest: JsRequest = {
      method: 'GET',
      uri: '/api/protected',
      headers: { 'x-auth': 'secret' },
      body: null,
      params: {},
      query: {}
    };

    const response = await router.handle(validRequest);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'Protected' });

    const invalidRequest: JsRequest = {
      method: 'GET',
      uri: '/api/protected',
      headers: { 'x-auth': 'wrong' },
      body: null,
      params: {},
      query: {}
    };

    await expect(router.handle(invalidRequest)).rejects.toThrow('Access denied by guard');
  });

  it('should handle validation and transform', async () => {
    const validRequest: JsRequest = {
      method: 'POST',
      uri: '/api/validated',
      headers: {},
      body: { name: 'test' },
      params: {},
      query: {}
    };

    const response = await router.handle(validRequest);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ name: 'test' });

    const invalidRequest: JsRequest = {
      method: 'POST',
      uri: '/api/validated',
      headers: {},
      body: {},
      params: {},
      query: {}
    };

    await expect(router.handle(invalidRequest)).rejects.toThrow('Name is required');
  });
}); 