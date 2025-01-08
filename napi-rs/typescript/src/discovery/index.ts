import { ControllerMetadata, RouteMetadata } from '../types';
import { createInternalError } from '../errors';

export interface ControllerInfo {
  path: string;
  metadata: ControllerMetadata;
  routes: RouteInfo[];
}

export interface RouteInfo {
  path: string;
  method: string;
  metadata: RouteMetadata;
  handler: Function;
}

export interface DiscoveryOptions {
  baseDir?: string;
  pattern?: string;
  exclude?: string[];
  recursive?: boolean;
}

export class ControllerDiscovery {
  private controllers: Map<string, ControllerInfo> = new Map();
  private routes: Map<string, RouteInfo> = new Map();

  registerController(controller: any, path: string): void {
    const metadata = Reflect.getMetadata('controller', controller.constructor);
    if (!metadata) {
      throw createInternalError(`No controller metadata found for ${controller.constructor.name}`);
    }

    const controllerInfo: ControllerInfo = {
      path,
      metadata,
      routes: [],
    };

    this.controllers.set(controller.constructor.name, controllerInfo);
    this.discoverRoutes(controller, controllerInfo);
  }

  private discoverRoutes(controller: any, controllerInfo: ControllerInfo): void {
    const prototype = controller.constructor.prototype;
    const propertyNames = Object.getOwnPropertyNames(prototype);

    for (const propertyName of propertyNames) {
      const routeMetadata = Reflect.getMetadata('route', prototype, propertyName);
      if (routeMetadata) {
        const routeInfo: RouteInfo = {
          path: this.combinePaths(controllerInfo.metadata.path, routeMetadata.path),
          method: routeMetadata.method,
          metadata: routeMetadata,
          handler: prototype[propertyName].bind(controller),
        };

        const routeKey = `${routeInfo.method}:${routeInfo.path}`;
        this.routes.set(routeKey, routeInfo);
        controllerInfo.routes.push(routeInfo);
      }
    }
  }

  private combinePaths(basePath: string, routePath: string): string {
    return `${basePath.replace(/\/$/, '')}/${routePath.replace(/^\//, '')}`;
  }

  getControllers(): ControllerInfo[] {
    return Array.from(this.controllers.values());
  }

  getRoutes(): RouteInfo[] {
    return Array.from(this.routes.values());
  }

  findRoute(method: string, path: string): RouteInfo | undefined {
    const routeKey = `${method}:${path}`;
    return this.routes.get(routeKey);
  }
}

export function createControllerDiscovery(): ControllerDiscovery {
  return new ControllerDiscovery();
}

// Utility functions for controller and route discovery
export function getControllerMetadata(target: any): ControllerMetadata | undefined {
  return Reflect.getMetadata('controller', target);
}

export function getRouteMetadata(target: any, propertyKey: string): RouteMetadata | undefined {
  return Reflect.getMetadata('route', target, propertyKey);
}

export function getParamMetadata(target: any, propertyKey: string): any[] {
  return Reflect.getMetadata('params', target, propertyKey) || [];
}

export function getValidationMetadata(target: any, propertyKey: string): any {
  return Reflect.getMetadata('validation', target, propertyKey);
}

export function getMiddlewareMetadata(target: any, propertyKey?: string): any[] {
  if (propertyKey) {
    return Reflect.getMetadata('middleware', target, propertyKey) || [];
  }
  return Reflect.getMetadata('middleware', target) || [];
}

export function getHookMetadata(target: any, propertyKey?: string): any[] {
  if (propertyKey) {
    return Reflect.getMetadata('hooks', target, propertyKey) || [];
  }
  return Reflect.getMetadata('hooks', target) || [];
}

// Helper functions for path manipulation
export function normalizePath(path: string): string {
  return `/${path.replace(/^\/+|\/+$/g, '')}`;
}

export function matchPath(pattern: string, path: string): boolean {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);

  if (patternParts.length !== pathParts.length) {
    return false;
  }

  return patternParts.every((part, index) => {
    if (part.startsWith(':')) {
      return true;
    }
    return part === pathParts[index];
  });
}

export function extractPathParams(pattern: string, path: string): Record<string, string> {
  const params: Record<string, string> = {};
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);

  patternParts.forEach((part, index) => {
    if (part.startsWith(':')) {
      const paramName = part.slice(1);
      params[paramName] = pathParts[index];
    }
  });

  return params;
}

// Function to scan directory for controllers
export async function scanControllers(_options: DiscoveryOptions = {}): Promise<any[]> {
  // Implementation will be added later
  return [];
} 