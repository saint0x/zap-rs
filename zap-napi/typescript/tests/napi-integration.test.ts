import { createRouter } from '../src/bindings';
import { JsRequest, JsResponse } from '../src/types';

describe('Router Integration Tests', () => {
  it('should handle GET requests', async () => {
    const router = createRouter();
    
    const request: JsRequest = {
      method: 'GET',
      uri: '/test',
      headers: {},
      body: undefined,
      params: {},
      query: {},
    };

    router.get('/test', (req: JsRequest): JsResponse => {
      expect(req.method).toBe('GET');
      expect(req.uri).toBe('/test');
      
      return {
        status: 200,
        headers: {},
        body: {
          type: 'Text',
          content: 'Success'
        }
      };
    });

    const response = await router.handle(request);
    expect(response.status).toBe(200);
    expect(response.body?.type).toBe('Text');
    expect(response.body?.content).toBe('Success');
  });

  it('should handle async handlers', async () => {
    const router = createRouter();
    
    const request: JsRequest = {
      method: 'GET',
      uri: '/async',
      headers: {},
      body: undefined,
      params: {},
      query: {},
    };

    router.get('/async', async (req: JsRequest): Promise<JsResponse> => {
      return {
        status: 200,
        headers: {},
        body: {
          type: 'Text',
          content: 'Async Success'
        }
      };
    });

    const response = await router.handle(request);
    expect(response.status).toBe(200);
    expect(response.body?.content).toBe('Async Success');
  });

  it('should handle 404 for unknown routes', async () => {
    const router = createRouter();
    
    const request: JsRequest = {
      method: 'GET',
      uri: '/unknown',
      headers: {},
      body: undefined,
      params: {},
      query: {},
    };

    const response = await router.handle(request);
    expect(response.status).toBe(404);
  });
}); 