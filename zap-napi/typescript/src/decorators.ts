import { Router as RouterClass } from './router';
import { RouteHandler, Guard as GuardFn, Middleware as MiddlewareType, ValidationFn, TransformFn, JsResponse, StatusCode, JsRequest } from './types';
import 'reflect-metadata';

// Type definitions for decorators
type ClassDecorator = <T extends { new (...args: any[]): any }>(target: T) => T;
type MethodDecorator = <T>(target: Object, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<T>) => TypedPropertyDescriptor<T> | void;
type ParameterDecorator = (target: Object, propertyKey: string | symbol, parameterIndex: number) => void;

interface RouteInfo {
  httpMethod: string;
  path: string;
  middlewares: MiddlewareType[];
  guards: GuardFn[];
  validators: ValidationFn[];
  transformers: TransformFn[];
}

function createMethodDecorator(method: string, path: string): MethodDecorator {
  console.log(`[METHOD:${method}] Creating decorator for path: ${path}`);
  return function(target: any, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<any>) {
    console.log(`\n[METHOD:${method}:${String(propertyKey)}] Applying decorator`);
    console.log(`[METHOD:${method}:${String(propertyKey)}] Target:`, target);
    console.log(`[METHOD:${method}:${String(propertyKey)}] Property:`, propertyKey);
    console.log(`[METHOD:${method}:${String(propertyKey)}] Descriptor:`, descriptor);

    // Get existing route info or create new one
    const existingRouteInfo = Reflect.getMetadata('zap:route', target, propertyKey) as RouteInfo;
    console.log(`[METHOD:${method}:${String(propertyKey)}] Existing route info:`, existingRouteInfo);
    
    const routeInfo: RouteInfo = existingRouteInfo || {
      httpMethod: method,
      path,
      middlewares: [],
      guards: [],
      validators: [],
      transformers: []
    };

    // Update route info
    if (existingRouteInfo) {
      console.log(`[METHOD:${method}:${String(propertyKey)}] Updating existing route info`);
      routeInfo.httpMethod = method;
      routeInfo.path = path;
    } else {
      console.log(`[METHOD:${method}:${String(propertyKey)}] Creating new route info`);
    }

    console.log(`[METHOD:${method}:${String(propertyKey)}] Final route info:`, routeInfo);
    Reflect.defineMetadata('zap:route', routeInfo, target, propertyKey);
    
    const allMetadata = Reflect.getMetadataKeys(target);
    console.log(`[METHOD:${method}:${String(propertyKey)}] All metadata keys:`, allMetadata);
    const finalRouteInfo = Reflect.getMetadata('zap:route', target, propertyKey);
    console.log(`[METHOD:${method}:${String(propertyKey)}] Verified route metadata:`, finalRouteInfo);
    
    return descriptor;
  };
}

export namespace zap {
  // Export Router class
  export type Router = RouterClass;
  export const Router = RouterClass;

  // Export types
  export type Request = JsRequest;
  export type Response = JsResponse;
  export type Middleware = MiddlewareType;
  export type Guard = GuardFn;

  // Export helper functions
  export function createResponse(status: number, headers: Record<string, string>, body: any): Response {
    return { status, headers, body };
  }

  export function controller(path: string = '/', middleware?: MiddlewareType[]): ClassDecorator {
    console.log(`[DECORATOR] Creating controller decorator for path: ${path}`);
    return function(target: any) {
      console.log(`[DECORATOR] Applying controller decorator to class: ${target.name}`);
      console.log('[DECORATOR] Original constructor:', target);
      const originalConstructor = target;
      function newConstructor(...args: any[]) {
        console.log(`[CONSTRUCTOR] Creating instance of ${target.name}`);
        console.log('[CONSTRUCTOR] Arguments:', args);
        const instance = new originalConstructor(...args);
        console.log('[CONSTRUCTOR] Instance created:', instance);
        const router = args[0] as RouterClass;
        console.log('[CONSTRUCTOR] Router from args:', router);
        if (!router) {
          throw new Error('Router instance must be provided to controller constructor');
        }

        // Register global middleware
        if (middleware) {
          console.log(`[MIDDLEWARE] Registering ${middleware.length} global middleware(s)`);
          middleware.forEach(m => router.use(m));
        }

        // Get all method decorators and register routes
        const prototype = Object.getPrototypeOf(instance);
        console.log('[ROUTES] Prototype:', prototype);
        const methodNames = Object.getOwnPropertyNames(prototype).filter(
          name => name !== 'constructor' && typeof prototype[name] === 'function'
        );
        console.log(`[ROUTES] Found methods: ${methodNames.join(', ')}`);

        for (const methodName of methodNames) {
          console.log(`\n[ROUTE:${methodName}] Processing method`);
          console.log(`[ROUTE:${methodName}] Method definition:`, prototype[methodName]);
          const metadataKeys = Reflect.getMetadataKeys(prototype, methodName);
          console.log(`[ROUTE:${methodName}] Metadata keys:`, metadataKeys);
          const routeInfo = Reflect.getMetadata('zap:route', prototype, methodName) as RouteInfo;
          console.log(`[ROUTE:${methodName}] Route info:`, routeInfo);
          
          if (routeInfo) {
            const fullPath = `${path}${routeInfo.path}`;
            console.log(`[ROUTE:${methodName}] Full path: ${fullPath}`);
            const handler = prototype[methodName].bind(instance);
            console.log(`[ROUTE:${methodName}] Bound handler:`, handler);

            // Register route with router
            console.log(`[ROUTE:${methodName}] Registering route: ${routeInfo.httpMethod} ${fullPath}`);
            try {
              router.registerRoute(routeInfo.httpMethod, fullPath, handler as RouteHandler);
              console.log(`[ROUTE:${methodName}] Route registered successfully`);
            } catch (error) {
              console.error(`[ROUTE:${methodName}] Failed to register route:`, error);
            }

            // Register middleware
            if (routeInfo.middlewares.length > 0) {
              console.log(`[ROUTE:${methodName}] Registering ${routeInfo.middlewares.length} middleware(s)`);
              routeInfo.middlewares.forEach(m => router.use(m));
            }

            // Register guards
            if (routeInfo.guards.length > 0) {
              console.log(`[ROUTE:${methodName}] Registering ${routeInfo.guards.length} guard(s)`);
              routeInfo.guards.forEach(g => router.guard(g));
            }

            // Register validators
            if (routeInfo.validators.length > 0) {
              console.log(`[ROUTE:${methodName}] Registering ${routeInfo.validators.length} validator(s)`);
              routeInfo.validators.forEach(v => router.validate(v));
            }

            // Register transformers
            if (routeInfo.transformers.length > 0) {
              console.log(`[ROUTE:${methodName}] Registering ${routeInfo.transformers.length} transformer(s)`);
              routeInfo.transformers.forEach(t => router.transform(t));
            }
          } else {
            console.log(`[ROUTE:${methodName}] No route info found - method is not a route handler`);
          }
        }

        return instance;
      }
      newConstructor.prototype = originalConstructor.prototype;
      return newConstructor as any;
    };
  }

  export function get(path: string): MethodDecorator {
    return createMethodDecorator('GET', path);
  }

  export function post(path: string): MethodDecorator {
    return createMethodDecorator('POST', path);
  }

  export function put(path: string): MethodDecorator {
    return createMethodDecorator('PUT', path);
  }

  export function del(path: string): MethodDecorator {
    return createMethodDecorator('DELETE', path);
  }

  export function options(path: string): MethodDecorator {
    return createMethodDecorator('OPTIONS', path);
  }

  export function head(path: string): MethodDecorator {
    return createMethodDecorator('HEAD', path);
  }

  export function use(middleware: MiddlewareType): MethodDecorator {
    return function(target: any, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<any>) {
      console.log(`Adding middleware to ${String(propertyKey)}`);
      console.log('Target:', target);
      console.log('Property key:', propertyKey);
      console.log('Descriptor:', descriptor);
      const routeInfo = Reflect.getMetadata('zap:route', target, propertyKey) as RouteInfo;
      console.log('Route info from metadata:', routeInfo);
      if (routeInfo) {
        routeInfo.middlewares.push(middleware);
        Reflect.defineMetadata('zap:route', routeInfo, target, propertyKey);
      }
      return descriptor;
    };
  }

  export function guard(guardFn: GuardFn): MethodDecorator {
    return function(target: any, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<any>) {
      console.log(`Adding guard to ${String(propertyKey)}`);
      console.log('Target:', target);
      console.log('Property key:', propertyKey);
      console.log('Descriptor:', descriptor);
      const routeInfo = Reflect.getMetadata('zap:route', target, propertyKey) as RouteInfo;
      console.log('Route info from metadata:', routeInfo);
      if (routeInfo) {
        routeInfo.guards.push(guardFn);
        Reflect.defineMetadata('zap:route', routeInfo, target, propertyKey);
      }
      return descriptor;
    };
  }

  export function validate(validation: ValidationFn): MethodDecorator {
    return function(target: any, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<any>) {
      console.log(`Adding validator to ${String(propertyKey)}`);
      console.log('Target:', target);
      console.log('Property key:', propertyKey);
      console.log('Descriptor:', descriptor);
      const routeInfo = Reflect.getMetadata('zap:route', target, propertyKey) as RouteInfo;
      console.log('Route info from metadata:', routeInfo);
      if (routeInfo) {
        routeInfo.validators.push(validation);
        Reflect.defineMetadata('zap:route', routeInfo, target, propertyKey);
      }
      return descriptor;
    };
  }

  export function transform(transform: TransformFn): MethodDecorator {
    return function(target: any, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<any>) {
      console.log(`Adding transformer to ${String(propertyKey)}`);
      console.log('Target:', target);
      console.log('Property key:', propertyKey);
      console.log('Descriptor:', descriptor);
      const routeInfo = Reflect.getMetadata('zap:route', target, propertyKey) as RouteInfo;
      console.log('Route info from metadata:', routeInfo);
      if (routeInfo) {
        routeInfo.transformers.push(transform);
        Reflect.defineMetadata('zap:route', routeInfo, target, propertyKey);
      }
      return descriptor;
    };
  }

  export function response(transform: (data: any) => any): MethodDecorator {
    return function(target: any, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<any>) {
      console.log(`Adding response transformer to ${String(propertyKey)}`);
      console.log('Target:', target);
      console.log('Property key:', propertyKey);
      console.log('Descriptor:', descriptor);
      const originalMethod = descriptor.value;
      descriptor.value = async function(...args: any[]) {
        const result = await originalMethod.apply(this, args);
        if (result && typeof result === 'object') {
          const transformedBody = await transform(result.body);
          return {
            ...result,
            body: transformedBody
          } as JsResponse;
        }
        return result;
      };
      return descriptor;
    };
}

  export function status(code: StatusCode): MethodDecorator {
  return function(target: any, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<any>) {
      console.log(`Adding status code ${code} to ${String(propertyKey)}`);
      console.log('Target:', target);
      console.log('Property key:', propertyKey);
      console.log('Descriptor:', descriptor);
    const originalMethod = descriptor.value;
    descriptor.value = async function(...args: any[]) {
        const result = await originalMethod.apply(this, args);
        if (result && typeof result === 'object') {
          return {
            ...result,
            status: code
          } as JsResponse;
        }
        return result;
    };
    return descriptor;
  };
  }

  export function param(name: string): ParameterDecorator {
    return function(target: Object, propertyKey: string | symbol, parameterIndex: number): void {
      console.log(`Adding param decorator for ${name} to parameter ${parameterIndex} of ${String(propertyKey)}`);
      console.log('Target:', target);
      console.log('Property key:', propertyKey);
      console.log('Parameter index:', parameterIndex);
      const metadata = Reflect.getMetadata('zap:params', target.constructor) || {};
      metadata[propertyKey] = metadata[propertyKey] || [];
      metadata[propertyKey].push({
        index: parameterIndex,
        type: 'path',
        name
      });
      Reflect.defineMetadata('zap:params', metadata, target.constructor);
    };
  }

  export function query(name: string): ParameterDecorator {
    return function(target: Object, propertyKey: string | symbol, parameterIndex: number): void {
      console.log(`Adding query decorator for ${name} to parameter ${parameterIndex} of ${String(propertyKey)}`);
      console.log('Target:', target);
      console.log('Property key:', propertyKey);
      console.log('Parameter index:', parameterIndex);
      const metadata = Reflect.getMetadata('zap:params', target.constructor) || {};
      metadata[propertyKey] = metadata[propertyKey] || [];
      metadata[propertyKey].push({
        index: parameterIndex,
        type: 'query',
        name
      });
      Reflect.defineMetadata('zap:params', metadata, target.constructor);
    };
  }

  export function body(): ParameterDecorator {
    return function(target: Object, propertyKey: string | symbol, parameterIndex: number): void {
      console.log(`Adding body decorator to parameter ${parameterIndex} of ${String(propertyKey)}`);
      console.log('Target:', target);
      console.log('Property key:', propertyKey);
      console.log('Parameter index:', parameterIndex);
      const metadata = Reflect.getMetadata('zap:params', target.constructor) || {};
      metadata[propertyKey] = metadata[propertyKey] || [];
      metadata[propertyKey].push({
        index: parameterIndex,
        type: 'body'
      });
      Reflect.defineMetadata('zap:params', metadata, target.constructor);
    };
  }

  export function header(name: string): ParameterDecorator {
    return function(target: Object, propertyKey: string | symbol, parameterIndex: number): void {
      console.log(`Adding header decorator for ${name} to parameter ${parameterIndex} of ${String(propertyKey)}`);
      console.log('Target:', target);
      console.log('Property key:', propertyKey);
      console.log('Parameter index:', parameterIndex);
      const metadata = Reflect.getMetadata('zap:params', target.constructor) || {};
      metadata[propertyKey] = metadata[propertyKey] || [];
      metadata[propertyKey].push({
        index: parameterIndex,
        type: 'header',
        name
      });
      Reflect.defineMetadata('zap:params', metadata, target.constructor);
    };
  }
}