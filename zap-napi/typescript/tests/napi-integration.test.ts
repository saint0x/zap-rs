import { Router } from '../src/router';
import { JsRequest, JsResponse } from '../src/types';

describe('Router Integration Tests', () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
  });

  test('basic route handling', async () => {
    const handler = jest.fn().mockResolvedValue({
      status: 200,
      headers: {},
      body: { message: 'success' }
    });

    await router.get('/test', handler);

    const request: JsRequest = {
      method: 'GET',
      uri: '/test',
      headers: {},
      body: null,
      params: {},
      query: {}
    };

    const response = await router.handle(request);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'success' });
    expect(handler).toHaveBeenCalledWith(request);
  });

  test('route with parameters', async () => {
    const handler = jest.fn().mockResolvedValue({
      status: 200,
      headers: {},
      body: { id: '123' }
    });

    await router.get('/users/:id', handler);

    const request: JsRequest = {
      method: 'GET',
      uri: '/users/123',
      headers: {},
      body: null,
      params: {},
      query: {}
    };

    const response = await router.handle(request);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: '123' });
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      params: { id: '123' }
    }));
  });

  test('middleware execution', async () => {
    const middleware = jest.fn().mockImplementation(async (req, next) => {
      req.headers['x-middleware'] = 'executed';
      await next();
    });

    const handler = jest.fn().mockImplementation(async (req) => ({
      status: 200,
      headers: {},
      body: { middlewareHeader: req.headers['x-middleware'] }
    }));

    const middlewareId = await router.registerMiddleware(middleware);
    await router.get('/protected', handler, {
      middleware: [middlewareId]
    });

    const request: JsRequest = {
      method: 'GET',
      uri: '/protected',
      headers: {},
      body: null,
      params: {},
      query: {}
    };

    const response = await router.handle(request);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ middlewareHeader: 'executed' });
    expect(middleware).toHaveBeenCalled();
  });

  test('guard protection', async () => {
    const guard = jest.fn().mockResolvedValue(false);
    const handler = jest.fn();

    const guardId = await router.registerMiddleware(async (req) => {
      const allowed = await guard(req);
      if (!allowed) throw new Error('Access denied');
    });

    await router.get('/admin', handler, {
      guards: [guardId]
    });

    const request: JsRequest = {
      method: 'GET',
      uri: '/admin',
      headers: {},
      body: null,
      params: {},
      query: {}
    };

    await expect(router.handle(request)).rejects.toThrow('Access denied');
    expect(guard).toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  test('validation and transform', async () => {
    const validation = jest.fn().mockImplementation(async (data) => ({
      ...data,
      validated: true
    }));

    const transform = jest.fn().mockImplementation(async (data) => ({
      ...data,
      transformed: true
    }));

    const handler = jest.fn().mockImplementation(async (req) => ({
      status: 200,
      headers: {},
      body: req.body
    }));

    await router.post('/data', handler, {
      validation: validation,
      transform: transform
    });

    const request: JsRequest = {
      method: 'POST',
      uri: '/data',
      headers: {},
      body: { original: true },
      params: {},
      query: {}
    };

    const response = await router.handle(request);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      original: true,
      validated: true,
      transformed: true
    });
    expect(validation).toHaveBeenCalled();
    expect(transform).toHaveBeenCalled();
  });
}); 