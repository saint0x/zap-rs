import { Router } from './router';
import { RouteHandler, Guard as GuardFn, Middleware, ValidationFn, TransformFn } from './types';
import { RouteConfig } from 'zap-napi';

// Type definitions for decorators
type ClassDecorator = <T extends { new (...args: any[]): any }>(target: T) => T;
type MethodDecorator = <T>(target: Object, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<T>) => TypedPropertyDescriptor<T> | void;

export namespace zap {
  export function controller(path: string = '/'): ClassDecorator {
    return function(target: any) {
      return target;
    };
  }

  export function get(path: string, config?: RouteConfig): MethodDecorator {
    return createMethodDecorator('GET', path, config);
  }

  export function post(path: string, config?: RouteConfig): MethodDecorator {
    return createMethodDecorator('POST', path, config);
  }

  export function put(path: string, config?: RouteConfig): MethodDecorator {
    return createMethodDecorator('PUT', path, config);
  }

  export function del(path: string, config?: RouteConfig): MethodDecorator {
    return createMethodDecorator('DELETE', path, config);
  }

  export function use(middleware: Middleware): MethodDecorator {
    return function(target: any, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<any>) {
      const originalMethod = descriptor.value;
      descriptor.value = async function(...args: any[]) {
        const router = (this as any).router as Router;
        const id = await router.registerMiddleware(middleware);
        const config = (this as any).routeConfig || {};
        config.middleware = config.middleware || [];
        config.middleware.push(id);
        (this as any).routeConfig = config;
        return originalMethod.apply(this, args);
      };
      return descriptor;
    };
  }

  export function guard(guardFn: GuardFn): MethodDecorator {
    return function(target: any, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<any>) {
      const originalMethod = descriptor.value;
      descriptor.value = async function(...args: any[]) {
        const router = (this as any).router as Router;
        const id = await router.registerMiddleware(async (ctx: any) => {
          const allowed = await guardFn(ctx);
          if (!allowed) {
            throw new Error('Access denied by guard');
          }
        });
        const config = (this as any).routeConfig || {};
        config.guards = config.guards || [];
        config.guards.push(id);
        (this as any).routeConfig = config;
        return originalMethod.apply(this, args);
      };
      return descriptor;
    };
  }

  export function validate(validation: ValidationFn): MethodDecorator {
    return function(target: any, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<any>) {
      const originalMethod = descriptor.value;
      descriptor.value = async function(...args: any[]) {
        const router = (this as any).router as Router;
        const id = await router.registerMiddleware(async (ctx: any) => {
          ctx.body = await validation(ctx.body);
        });
        const config = (this as any).routeConfig || {};
        config.validation = id;
        (this as any).routeConfig = config;
        return originalMethod.apply(this, args);
      };
      return descriptor;
    };
  }

  export function transform(transform: TransformFn): MethodDecorator {
    return function(target: any, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<any>) {
      const originalMethod = descriptor.value;
      descriptor.value = async function(...args: any[]) {
        const router = (this as any).router as Router;
        const id = await router.registerMiddleware(async (ctx: any) => {
          ctx.body = await transform(ctx.body);
        });
        const config = (this as any).routeConfig || {};
        config.transform = id;
        (this as any).routeConfig = config;
        return originalMethod.apply(this, args);
      };
      return descriptor;
    };
  }
}

function createMethodDecorator(method: string, path: string, config?: RouteConfig): MethodDecorator {
  return function(target: any, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<any>) {
    const originalMethod = descriptor.value;
    descriptor.value = async function(...args: any[]) {
      const router = (this as any).router as Router;
      const handler = originalMethod.bind(this);
      await router.registerRoute(method, path, handler as RouteHandler, config);
      return handler(...args);
    };
    return descriptor;
  };
} 