import 'reflect-metadata';
import { mocks } from './jest.setup';
import { Zap } from '@zap/zap';
import { RequestContext, ResponseContext } from '@zap/types';

describe('NAPI Integration', () => {
  let zap: Zap;

  beforeEach(() => {
    zap = new Zap();
    // Reset mock implementations
    jest.clearAllMocks();
    // Setup default mock implementations
    mocks.router.handleRequest.mockResolvedValue({ status: 200 });
    mocks.hooks.addHook.mockImplementation(() => {});
    mocks.hooks.removeHook.mockImplementation(() => {});
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
      const error = new Error('Router error');
      mocks.router.handleRequest.mockRejectedValue(error);

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
      const error = new Error('Store error');
      mocks.store.set.mockRejectedValue(error);
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
      // Setup mock to throw error
      const error = new Error('Hook error');
      const errorHook = async () => { throw error; };
      mocks.hooks.addHook.mockImplementation(() => {
        throw error;
      });

      expect(() => zap.addHook('pre-routing', errorHook)).toThrow('Hook error');
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
      mocks.hooks.executeHooks.mockImplementation(async (phase, ctx) => {
        if (phase === 'pre-handler') {
          await preHook(ctx);
        } else if (phase === 'post-handler') {
          await postHook(ctx);
        }
      });

      zap.addHook('pre-handler', preHook);
      zap.addHook('post-handler', postHook);

      // Mock route handling
      mocks.router.handleRequest.mockImplementation(async () => {
        await mocks.hooks.executeHooks('pre-handler', {});
        flowOrder.push('handler');
        await mocks.hooks.executeHooks('post-handler', {});
        return { status: 200 };
      });

      // Simulate request
      await zap.handleRequest('GET', '/test');

      // Verify flow order
      expect(flowOrder).toEqual(['pre-hook', 'handler', 'post-hook']);
    });
  });
}); 