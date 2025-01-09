import 'reflect-metadata';
import { Request, Response, RouteHandler, Middleware, Hook, ValidationSchema } from './types';

export function controller(path: string): ClassDecorator {
  return (target: Function) => {
    Reflect.defineMetadata('controller', { path }, target);
  };
}

export function route(method: string, path: string): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    Reflect.defineMetadata('route', { method, path }, target, propertyKey.toString());
    return descriptor;
  };
}

// HTTP method decorators
export function get(path: string): MethodDecorator {
  return route('GET', path);
}

export function post(path: string): MethodDecorator {
  return route('POST', path);
}

export function put(path: string): MethodDecorator {
  return route('PUT', path);
}

export function del(path: string): MethodDecorator {
  return route('DELETE', path);
}

export function patch(path: string): MethodDecorator {
  return route('PATCH', path);
}

export function options(path: string): MethodDecorator {
  return route('OPTIONS', path);
}

export function head(path: string): MethodDecorator {
  return route('HEAD', path);
}

// Middleware decorators
export function useMiddleware(middleware: Middleware | Middleware[]): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const middlewares = Array.isArray(middleware) ? middleware : [middleware];
    const existingMiddleware = Reflect.getMetadata('middleware', target, propertyKey.toString()) || [];
    Reflect.defineMetadata('middleware', [...existingMiddleware, ...middlewares], target, propertyKey.toString());
    return descriptor;
  };
}

export function useClass(middleware: Middleware | Middleware[]): ClassDecorator {
  return (target: Function) => {
    const middlewares = Array.isArray(middleware) ? middleware : [middleware];
    const existingMiddleware = Reflect.getMetadata('middleware', target) || [];
    Reflect.defineMetadata('middleware', [...existingMiddleware, ...middlewares], target);
  };
}

// Hook decorators
export function hookMethod(hook: Hook): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const existingHooks = Reflect.getMetadata('hooks', target, propertyKey.toString()) || [];
    Reflect.defineMetadata('hooks', [...existingHooks, hook], target, propertyKey.toString());
    return descriptor;
  };
}

export function hookClass(hook: Hook): ClassDecorator {
  return (target: Function) => {
    const existingHooks = Reflect.getMetadata('hooks', target) || [];
    Reflect.defineMetadata('hooks', [...existingHooks, hook], target);
  };
}

// Parameter decorators
export function param(name: string): ParameterDecorator {
  return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number): void => {
    if (propertyKey === undefined) return;
    const params = Reflect.getMetadata('params', target, propertyKey.toString()) || [];
    params[parameterIndex] = { type: 'param', name };
    Reflect.defineMetadata('params', params, target, propertyKey.toString());
  };
}

export function query(name: string): ParameterDecorator {
  return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number): void => {
    if (propertyKey === undefined) return;
    const params = Reflect.getMetadata('params', target, propertyKey.toString()) || [];
    params[parameterIndex] = { type: 'query', name };
    Reflect.defineMetadata('params', params, target, propertyKey.toString());
  };
}

export function body(): ParameterDecorator {
  return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number): void => {
    if (propertyKey === undefined) return;
    const params = Reflect.getMetadata('params', target, propertyKey.toString()) || [];
    params[parameterIndex] = { type: 'body' };
    Reflect.defineMetadata('params', params, target, propertyKey.toString());
  };
}

export function header(name: string): ParameterDecorator {
  return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number): void => {
    if (propertyKey === undefined) return;
    const params = Reflect.getMetadata('params', target, propertyKey.toString()) || [];
    params[parameterIndex] = { type: 'header', name };
    Reflect.defineMetadata('params', params, target, propertyKey.toString());
  };
}

// Validation decorator
export function validate(schema: ValidationSchema): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    Reflect.defineMetadata('validation', { schema }, target, propertyKey.toString());
    return descriptor;
  };
}

// Aliases for backward compatibility
export const use = useClass;
export const hook = hookMethod; 