import { 
  ClassDecorator, 
  MethodDecorator, 
  ParameterDecorator,
  ControllerMetadata,
  RouteMetadata,
  HttpMethod,
  Middleware,
  ValidationSchema,
  Hook
} from './types';

const CONTROLLER_METADATA_KEY = Symbol('zap:controller');
const ROUTE_METADATA_KEY = Symbol('zap:route');
const PARAM_METADATA_KEY = Symbol('zap:parameter');

// Controller decorator
export function controller(path: string): ClassDecorator {
  return (target) => {
    const metadata: ControllerMetadata = { path, middlewares: [] };
    Reflect.defineMetadata(CONTROLLER_METADATA_KEY, metadata, target);
    return target;
  };
}

// Middleware decorator for controllers and routes
export function use(middleware: Middleware): ClassDecorator & MethodDecorator {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    if (propertyKey && descriptor) {
      // Method decorator
      const metadata: RouteMetadata = Reflect.getMetadata(ROUTE_METADATA_KEY, target, propertyKey) || { 
        middlewares: [], 
        hooks: [] 
      };
      metadata.middlewares = [...metadata.middlewares, middleware];
      Reflect.defineMetadata(ROUTE_METADATA_KEY, metadata, target, propertyKey);
      return descriptor;
    } else {
      // Class decorator
      const metadata: ControllerMetadata = Reflect.getMetadata(CONTROLLER_METADATA_KEY, target) || { 
        path: '', 
        middlewares: [] 
      };
      metadata.middlewares = [...metadata.middlewares, middleware];
      Reflect.defineMetadata(CONTROLLER_METADATA_KEY, metadata, target);
      return target;
    }
  };
}

// HTTP method decorators
function createMethodDecorator(method: HttpMethod, path: string): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    const metadata: RouteMetadata = Reflect.getMetadata(ROUTE_METADATA_KEY, target, propertyKey) || {
      middlewares: [],
      hooks: []
    };
    metadata.method = method;
    metadata.path = path;
    Reflect.defineMetadata(ROUTE_METADATA_KEY, metadata, target, propertyKey);
    return descriptor;
  };
}

export const get = (path: string) => createMethodDecorator('GET', path);
export const post = (path: string) => createMethodDecorator('POST', path);
export const put = (path: string) => createMethodDecorator('PUT', path);
export const del = (path: string) => createMethodDecorator('DELETE', path);
export const patch = (path: string) => createMethodDecorator('PATCH', path);

// Parameter decorators
export function body(): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    const metadata = { type: 'body', index: parameterIndex };
    Reflect.defineMetadata(PARAM_METADATA_KEY, metadata, target, propertyKey);
  };
}

export function query(): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    const metadata = { type: 'query', index: parameterIndex };
    Reflect.defineMetadata(PARAM_METADATA_KEY, metadata, target, propertyKey);
  };
}

export function param(name: string): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    const metadata = { type: 'param', name, index: parameterIndex };
    Reflect.defineMetadata(PARAM_METADATA_KEY, metadata, target, propertyKey);
  };
}

export function header(name: string): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    const metadata = { type: 'header', name, index: parameterIndex };
    Reflect.defineMetadata(PARAM_METADATA_KEY, metadata, target, propertyKey);
  };
}

// Validation decorator
export function validate<T>(schema: ValidationSchema<T>): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    const metadata: RouteMetadata = Reflect.getMetadata(ROUTE_METADATA_KEY, target, propertyKey) || {
      middlewares: [],
      hooks: []
    };
    metadata.validation = schema;
    Reflect.defineMetadata(ROUTE_METADATA_KEY, metadata, target, propertyKey);
    return descriptor;
  };
}

// Hook decorator
export function hook(phase: Hook['phase']): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    const metadata: RouteMetadata = Reflect.getMetadata(ROUTE_METADATA_KEY, target, propertyKey) || {
      middlewares: [],
      hooks: []
    };
    metadata.hooks.push({
      phase,
      handler: descriptor.value
    });
    Reflect.defineMetadata(ROUTE_METADATA_KEY, metadata, target, propertyKey);
    return descriptor;
  };
} 