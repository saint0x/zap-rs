import { Request, Response, RouteHandler, Middleware, Hook, Router, ZapError, RouterError } from './types';

// Load native module
let nativeModule: any;
try {
  nativeModule = require('../../index.node');
} catch (e) {
  throw new Error('Failed to load native module. Make sure the Rust code is built: ' + e);
}

// Factory functions
export const createRouter = (): Router => {
  const router = new nativeModule.JsRouter();
  return {
    handle: async (request: Request): Promise<Response> => {
      return router.handle(request);
    },
    handleRequest: async (request: Request): Promise<Response> => {
      return router.handle(request);
    },
    registerController: (controller: any) => {
      // Get metadata and register routes
      const metadata = Reflect.getMetadata('controller', controller.constructor);
      if (!metadata || !metadata.path) {
        throw new Error('Invalid controller: missing metadata');
      }

      const basePath = metadata.path;
      const prototype = Object.getPrototypeOf(controller);
      const propertyNames = Object.getOwnPropertyNames(prototype);

      for (const prop of propertyNames) {
        const routeMetadata = Reflect.getMetadata('route', prototype, prop);
        if (routeMetadata) {
          const { method, path } = routeMetadata;
          const fullPath = basePath + path;
          const handler = controller[prop].bind(controller);
          
          switch (method.toLowerCase()) {
            case 'get':
              router.get(fullPath, handler);
              break;
            case 'post':
              router.post(fullPath, handler);
              break;
            case 'put':
              router.put(fullPath, handler);
              break;
            case 'delete':
              router.delete(fullPath, handler);
              break;
            case 'patch':
              router.patch(fullPath, handler);
              break;
            case 'options':
              router.options(fullPath, handler);
              break;
            case 'head':
              router.head(fullPath, handler);
              break;
          }
        }
      }
    },
    use: (middleware: Middleware) => {
      router.useMiddleware(middleware);
    },
    useMiddleware: (middleware: Middleware) => {
      router.useMiddleware(middleware);
    },
    useHook: (hook: Hook) => {
      router.useHook(hook);
    },
    get: (path: string, handler: RouteHandler) => {
      router.get(path, handler);
    },
    post: (path: string, handler: RouteHandler) => {
      router.post(path, handler);
    },
    put: (path: string, handler: RouteHandler) => {
      router.put(path, handler);
    },
    delete: (path: string, handler: RouteHandler) => {
      router.delete(path, handler);
    },
    patch: (path: string, handler: RouteHandler) => {
      router.patch(path, handler);
    },
    options: (path: string, handler: RouteHandler) => {
      router.options(path, handler);
    },
    head: (path: string, handler: RouteHandler) => {
      router.head(path, handler);
    },
    setErrorHandler: (handler: (error: ZapError) => Promise<Response>) => {
      router.setErrorHandler((error: Error) => {
        const zapError: ZapError = {
          code: error instanceof RouterError ? error.code : 'INTERNAL_ERROR',
          message: error.message,
          details: error instanceof RouterError ? error.details : { stack: error.stack }
        };
        return handler(zapError);
      });
    },
    setLogger: (logger: (level: string, message: string) => void) => {
      router.setLogger(logger);
    }
  };
};

export const createStore = () => {
  return {
    set: async <T>(key: string, value: T): Promise<void> => {
      return nativeModule.store.set(key, value);
    },
    get: async <T>(key: string): Promise<T | null> => {
      return nativeModule.store.get(key);
    },
    delete: async (key: string): Promise<void> => {
      return nativeModule.store.delete(key);
    },
    clear: async (): Promise<void> => {
      return nativeModule.store.clear();
    }
  };
};

export const createHooks = () => {
  const hooks = new nativeModule.JsHooks();
  return {
    addPreRouting: (handler: (request: Request) => Promise<Request>) => {
      hooks.preRouting(handler);
    },
    addPostHandler: (handler: (response: Response) => Promise<Response>) => {
      hooks.postHandler(handler);
    },
    addErrorHandler: (handler: (error: ZapError) => Promise<Response>) => {
      hooks.errorHandler(handler);
    },
    addHook: (hook: Hook) => {
      switch (hook.phase) {
        case 'before':
          hooks.preRouting(hook.handler);
          break;
        case 'after':
          hooks.postHandler(hook.handler);
          break;
        case 'error':
          hooks.errorHandler(hook.handler);
          break;
      }
    },
    removeHook: (hook: Hook) => {
      // Implementation will be added when the native module supports hook removal
    }
  };
}; 