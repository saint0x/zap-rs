import 'reflect-metadata';
import { Router, RouteHandler, JsRequest, JsResponse } from './types';

// Store metadata
const metadataStore = new Map<string, any>();

export function Controller(path: string): ClassDecorator {
  return (target: any) => {
    Reflect.defineMetadata('controller', { path }, target);
  };
}

export function Route(method: string, path: string): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    if (typeof propertyKey === 'string') {
      Reflect.defineMetadata('route', { method, path }, target, propertyKey);
    }
  };
}

export function Get(path: string): MethodDecorator {
  return Route('get', path);
}

export function Post(path: string): MethodDecorator {
  return Route('post', path);
}

export function Put(path: string): MethodDecorator {
  return Route('put', path);
}

export function Delete(path: string): MethodDecorator {
  return Route('delete', path);
} 