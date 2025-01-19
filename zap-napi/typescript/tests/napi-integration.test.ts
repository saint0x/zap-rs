import { Router } from '../src/router';
import { JsRequest, JsResponse } from '../src/types';

describe('Router Integration Tests', () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
  });

  it('should handle basic GET request', async () => {
    const handler = async (req: JsRequest): Promise<JsResponse> => {
      return {
        status: 200,
        headers: {},
        body: { message: 'Hello World' }
      };
    };

    await router.get('/hello', handler);

    const request = {
      method: 'GET',
      uri: '/hello',
      headers: {},
      body: null
    };

    const response = await router.handle(request);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'Hello World' });
  });

  it('should handle middleware', async () => {
    const middleware = async (req: JsRequest, next: () => Promise<void>) => {
      req.headers['x-middleware'] = 'applied';
      await next();
    };

    const handler = async (req: JsRequest): Promise<JsResponse> => {
      return {
        status: 200,
        headers: {},
        body: { middleware: req.headers['x-middleware'] }
      };
    };

    await router.use(middleware);
    await router.get('/protected', handler);

    const request = {
      method: 'GET',
      uri: '/protected',
      headers: {},
      body: null
    };

    const response = await router.handle(request);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ middleware: 'applied' });
  });

  it('should handle guards', async () => {
    const guard = async (req: JsRequest): Promise<boolean> => {
      return req.headers['x-auth'] === 'secret';
    };

    const handler = async (req: JsRequest): Promise<JsResponse> => {
      return {
        status: 200,
        headers: {},
        body: { message: 'Protected content' }
      };
    };

    await router.guard(guard);
    await router.get('/admin', handler);

    const request = {
      method: 'GET',
      uri: '/admin',
      headers: { 'x-auth': 'secret' },
      body: null
    };

    const response = await router.handle(request);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'Protected content' });
  });

  it('should handle validation and transform', async () => {
    const validation = async (data: any): Promise<any> => {
      if (!data.name) {
        throw new Error('Name is required');
      }
      return data;
    };

    const transform = async (data: any): Promise<any> => {
      return { ...data, processed: true };
    };

    const handler = async (req: JsRequest): Promise<JsResponse> => {
      return {
        status: 200,
        headers: {},
        body: req.body
      };
    };

    await router.validate(validation);
    await router.transform(transform);
    await router.post('/data', handler);

    const request = {
      method: 'POST',
      uri: '/data',
      headers: {},
      body: { name: 'test' }
    };

    const response = await router.handle(request);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ name: 'test', processed: true });
  });
}); 