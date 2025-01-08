import 'reflect-metadata';
import { ControllerMetadata, RouteMetadata, Middleware, Hook, ValidationSchema, Request, RouteHandler } from './types';

// Controller decorator
export function controller(path: string = '/'): ClassDecorator {
  return (target: any) => {
    const metadata: ControllerMetadata = {
      path,
      middlewares: [],
      hooks: [],
      routes: []
    };
    Reflect.defineMetadata('controller', metadata, target);
  };
}

// HTTP method decorators
function createMethodDecorator(method: string) {
  return (path: string = '/'): MethodDecorator => {
    return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
      const metadata: RouteMetadata = {
        path,
        method,
        middlewares: Reflect.getMetadata('middleware', target, propertyKey as string) || [],
        hooks: Reflect.getMetadata('hooks', target, propertyKey as string) || [],
        validation: Reflect.getMetadata('validation', target, propertyKey as string),
        handler: descriptor.value as RouteHandler
      };
      Reflect.defineMetadata('route', metadata, target, propertyKey as string);
    };
  };
}

export const get = createMethodDecorator('GET');
export const post = createMethodDecorator('POST');
export const put = createMethodDecorator('PUT');
export const del = createMethodDecorator('DELETE');
export const patch = createMethodDecorator('PATCH');
export const options = createMethodDecorator('OPTIONS');
export const head = createMethodDecorator('HEAD');

// Middleware decorator
export function use(middleware: Middleware): ClassDecorator & MethodDecorator {
  return (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (propertyKey && descriptor) {
      // Method decorator
      const middlewares = Reflect.getMetadata('middleware', target, propertyKey as string) || [];
      middlewares.push(middleware);
      Reflect.defineMetadata('middleware', middlewares, target, propertyKey as string);
    } else {
      // Class decorator
      const middlewares = Reflect.getMetadata('middleware', target) || [];
      middlewares.push(middleware);
      Reflect.defineMetadata('middleware', middlewares, target);
    }
  };
}

// Hook decorator
export function hook(phase: Hook['phase']): MethodDecorator {
  return (_target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const hooks = Reflect.getMetadata('hooks', _target, propertyKey as string) || [];
    hooks.push({
      phase,
      handler: descriptor.value as (req: Request) => Promise<void>
    });
    Reflect.defineMetadata('hooks', hooks, _target, propertyKey as string);
  };
}

// Parameter decorators
export function param(name: string): ParameterDecorator {
  return (_target: any, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    if (propertyKey === undefined) return;
    const params = Reflect.getMetadata('params', _target, propertyKey as string) || [];
    params[parameterIndex] = { type: 'param', name };
    Reflect.defineMetadata('params', params, _target, propertyKey as string);
  };
}

export function query(name: string): ParameterDecorator {
  return (_target: any, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    if (propertyKey === undefined) return;
    const params = Reflect.getMetadata('params', _target, propertyKey as string) || [];
    params[parameterIndex] = { type: 'query', name };
    Reflect.defineMetadata('params', params, _target, propertyKey as string);
  };
}

export function body(): ParameterDecorator {
  return (_target: any, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    if (propertyKey === undefined) return;
    const params = Reflect.getMetadata('params', _target, propertyKey as string) || [];
    params[parameterIndex] = { type: 'body' };
    Reflect.defineMetadata('params', params, _target, propertyKey as string);
  };
}

export function header(name: string): ParameterDecorator {
  return (_target: any, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    if (propertyKey === undefined) return;
    const params = Reflect.getMetadata('params', _target, propertyKey as string) || [];
    params[parameterIndex] = { type: 'header', name };
    Reflect.defineMetadata('params', params, _target, propertyKey as string);
  };
}

// Validation decorator
export function validate(schema: ValidationSchema): MethodDecorator {
  return (_target: any, propertyKey: string | symbol, _descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('validation', { body: schema }, _target, propertyKey as string);
  };
}

// Error handling decorator
export function catchError(errorType: new (...args: any[]) => Error): MethodDecorator {
  return (_target: any, _propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        if (error instanceof errorType) {
          throw error;
        }
        throw error;
      }
    };
    return descriptor;
  };
}

// Cache decorator
export function cache(ttl: number = 60000): MethodDecorator {
  return (_target: any, _propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    const cacheStore = new Map<string, { value: any; expires: number }>();

    descriptor.value = async function(...args: any[]) {
      const key = JSON.stringify(args);
      const now = Date.now();
      const cached = cacheStore.get(key);

      if (cached && cached.expires > now) {
        return cached.value;
      }

      const result = await originalMethod.apply(this, args);
      cacheStore.set(key, { value: result, expires: now + ttl });
      return result;
    };
    return descriptor;
  };
}

// Rate limit decorator
export function rateLimit(options: { windowMs?: number; max?: number } = {}): MethodDecorator {
  const { windowMs = 60000, max = 100 } = options;
  const hits = new Map<string, { count: number; resetTime: number }>();

  return (_target: any, _propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function(req: Request, ...args: any[]) {
      const key = req.ip || 'unknown';
      const now = Date.now();
      
      let record = hits.get(key);
      if (!record || now > record.resetTime) {
        record = { count: 0, resetTime: now + windowMs };
        hits.set(key, record);
      }
      
      record.count++;
      if (record.count > max) {
        throw new Error('Too many requests');
      }
      
      return originalMethod.apply(this, [req, ...args]);
    };
    return descriptor;
  };
} 