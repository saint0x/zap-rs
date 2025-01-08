import { mocks } from './jest.setup';
import { Zap } from '../src/zap';
import { RequestContext, ResponseContext } from '../src/types';

describe('NAPI Integration', () => {
  let zap: Zap;

  beforeEach(() => {
    zap = new Zap();
  });

  describe('Router Integration', () => {
    it('should handle requests through NAPI router', async () => {
      // Setup mock response
      mocks.router.handleRequest.mockResolvedValue({
        status: 200,
        body: { message: 'success' }
      });

      const response = await zap.handleRequest(
        'GET',
        '/test',
        { 'content-type': 'application/json' },
        { data: 'test' }
      );

      expect(mocks.router.handleRequest).toHaveBeenCalledWith(
        'GET',
        '/test',
        { 'content-type': 'application/json' },
        { data: 'test' }
      );
      expect(response).toEqual({
        status: 200,
        body: { message: 'success' }
      });
    });

    it('should handle errors from NAPI router', async () => {
      mocks.router.handleRequest.mockRejectedValue(new Error('Router error'));

      await expect(zap.handleRequest('GET', '/test')).rejects.toThrow('Router error');
    });
  });

  describe('Store Integration', () => {
    it('should store and retrieve data through NAPI store', async () => {
      const testData = { key: 'value' };
      mocks.store.get.mockResolvedValue(testData);

      await zap.store('test-key', testData);
      const retrieved = await zap.retrieve('test-key');

      expect(mocks.store.set).toHaveBeenCalledWith('test-key', testData);
      expect(mocks.store.get).toHaveBeenCalledWith('test-key');
      expect(retrieved).toEqual(testData);
    });

    it('should handle store operations', async () => {
      await zap.store('key', 'value');
      await zap.remove('key');
      await zap.clearStore();

      expect(mocks.store.set).toHaveBeenCalledWith('key', 'value');
      expect(mocks.store.delete).toHaveBeenCalledWith('key');
      expect(mocks.store.clear).toHaveBeenCalled();
    });

    it('should handle store errors', async () => {
      mocks.store.set.mockRejectedValue(new Error('Store error'));
      await expect(zap.store('key', 'value')).rejects.toThrow('Store error');
    });
  });

  describe('Hooks Integration', () => {
    const testHook = async (ctx: RequestContext) => {
      ctx.headers['test'] = 'hook';
    };

    it('should register and remove hooks through NAPI', () => {
      zap.addHook('pre-routing', testHook);
      zap.removeHook('pre-routing', testHook);

      expect(mocks.hooks.addHook).toHaveBeenCalledWith('pre-routing', testHook);
      expect(mocks.hooks.removeHook).toHaveBeenCalledWith('pre-routing', testHook);
    });

    it('should handle hook errors', () => {
      mocks.hooks.addHook.mockImplementation(() => {
        throw new Error('Hook error');
      });

      expect(() => zap.addHook('pre-routing', testHook)).toThrow('Hook error');
    });
  });

  describe('End-to-End Flow', () => {
    it('should handle a complete request flow with middleware and hooks', async () => {
      const flowOrder: string[] = [];
      
      // Setup middleware
      const testMiddleware = async (ctx: RequestContext, next: () => Promise<void>) => {
        flowOrder.push('middleware');
        await next();
      };

      // Setup hooks
      const preHook = async (ctx: RequestContext) => {
        flowOrder.push('pre-hook');
      };

      const postHook = async (ctx: RequestContext) => {
        flowOrder.push('post-hook');
      };

      // Setup route handler
      const handler = async (ctx: RequestContext): Promise<ResponseContext> => {
        flowOrder.push('handler');
        return { status: 200 };
      };

      // Register components
      zap.addHook('pre-handler', preHook);
      zap.addHook('post-handler', postHook);
      mocks.router.addRoute.mockImplementation((method, path, h) => {
        h({
          params: {},
          query: {},
          headers: {},
          body: null
        });
      });

      // Simulate request
      await zap.handleRequest('GET', '/test');

      // Verify flow order
      expect(flowOrder).toEqual(['pre-hook', 'handler', 'post-hook']);
    });
  });
}); 