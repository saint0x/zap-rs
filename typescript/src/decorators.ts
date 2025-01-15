import 'reflect-metadata';
import type { JsRequest, JsResponse } from './types';

// Custom decorator types that match runtime behavior
type RouteDecorator = (target: any, propertyKey: string | symbol) => void;
type GuardDecorator = (target: any, propertyKey: string | symbol) => void;
type ValidateDecorator = (target: any, propertyKey: string | symbol) => void;
type TransformDecorator = (target: any, propertyKey: string | symbol) => void;
type UseDecorator = (target: any, propertyKey: string | symbol) => void;

// Metadata types
interface RouteMetadata {
  method: string;
  path: string;
  guards: Array<(request: JsRequest) => Promise<boolean>>;
  middleware: Array<(request: JsRequest, next: () => Promise<void>) => Promise<void>>;
  validation?: (data: any) => Promise<any>;
  transform?: (data: any) => Promise<any>;
}

interface ControllerMetadata {
  basePath: string;
  routes: Map<string | symbol, RouteMetadata>;
}

// Helper to get or create metadata
function getMetadata(target: any): ControllerMetadata {
  if (!Reflect.hasMetadata('zap:metadata', target)) {
    Reflect.defineMetadata('zap:metadata', {
      basePath: '',
      routes: new Map()
    }, target);
  }
  return Reflect.getMetadata('zap:metadata', target);
}

// Helper to create route decorators
function createMethodDecorator(method: string, path: string): RouteDecorator {
  return (target: any, propertyKey: string | symbol): void => {
    const metadata = getMetadata(target);
    if (!metadata.routes.has(propertyKey)) {
      metadata.routes.set(propertyKey, {
        method,
        path,
        guards: [],
        middleware: []
      });
    }
  };
}

// Public API
export const zap = {
  controller(basePath: string = '') {
    return (constructor: Function) => {
      const metadata = getMetadata(constructor.prototype);
      metadata.basePath = basePath;
    };
  },

  get(path: string): RouteDecorator {
    return createMethodDecorator('GET', path);
  },

  post(path: string): RouteDecorator {
    return createMethodDecorator('POST', path);
  },

  put(path: string): RouteDecorator {
    return createMethodDecorator('PUT', path);
  },

  del(path: string): RouteDecorator {
    return createMethodDecorator('DELETE', path);
  },

  guard(fn: (request: JsRequest) => Promise<boolean>): GuardDecorator {
    return (target: any, propertyKey: string | symbol): void => {
      const metadata = getMetadata(target);
      const route = metadata.routes.get(propertyKey);
      if (route) {
        route.guards.push(fn);
      }
    };
  },

  validate(fn: (data: any) => Promise<any>): ValidateDecorator {
    return (target: any, propertyKey: string | symbol): void => {
      const metadata = getMetadata(target);
      const route = metadata.routes.get(propertyKey);
      if (route) {
        route.validation = fn;
      }
    };
  },

  transform(fn: (data: any) => Promise<any>): TransformDecorator {
    return (target: any, propertyKey: string | symbol): void => {
      const metadata = getMetadata(target);
      const route = metadata.routes.get(propertyKey);
      if (route) {
        route.transform = fn;
      }
    };
  },

  use(fn: (request: JsRequest, next: () => Promise<void>) => Promise<void>): UseDecorator {
    return (target: any, propertyKey: string | symbol): void => {
      const metadata = getMetadata(target);
      const route = metadata.routes.get(propertyKey);
      if (route) {
        route.middleware.push(fn);
      }
    };
  }
}; 