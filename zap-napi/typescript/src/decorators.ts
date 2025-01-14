import { Router } from './router';
import { RouteHandler, Guard as GuardFn, Middleware, ValidationFn, TransformFn } from './types';
import { RouteConfig } from 'zap-napi';

export namespace zap {
  export function controller(path: string = '/') {
    return function(target: any) {
      return target;
    };
  }

  export function get(path: string, config?: RouteConfig) {
    return createMethodDecorator('GET', path, config);
  }

  export function post(path: string, config?: RouteConfig) {
    return createMethodDecorator('POST', path, config);
  }

  export function put(path: string, config?: RouteConfig) {
    return createMethodDecorator('PUT', path, config);
  }

  export function del(path: string, config?: RouteConfig) {
    return createMethodDecorator('DELETE', path, config);
  }

  export function use(middleware: Middleware) {
    return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
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

  export function guard(guardFn: GuardFn) {
    return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
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

  export function validate(validation: ValidationFn) {
    return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
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

  export function transform(transform: TransformFn) {
    return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
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

function createMethodDecorator(method: string, path: string, config?: RouteConfig) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
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