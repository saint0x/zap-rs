import 'reflect-metadata';

export const CONTROLLER_METADATA_KEY = 'controller';
export const ROUTE_METADATA_KEY = 'route';
export const MIDDLEWARE_METADATA_KEY = 'middleware';
export const HOOKS_METADATA_KEY = 'hooks';
export const PARAMS_METADATA_KEY = 'params';
export const VALIDATION_METADATA_KEY = 'validation';

type MetadataTarget = Function | object;

/**
 * Get all metadata keys for a target
 */
export function getMetadataKeys(target: MetadataTarget): string[] {
  return Reflect.getMetadataKeys(target) as string[];
}

/**
 * Get metadata for a key from a target
 */
export function getMetadata(key: string, target: MetadataTarget): Record<string, unknown> | undefined {
  return Reflect.getMetadata(key, target) as Record<string, unknown> | undefined;
}

/**
 * Define metadata on a target
 */
export function defineMetadata(key: string, value: unknown, target: MetadataTarget): void {
  Reflect.defineMetadata(key, value, target);
}

/**
 * Check if a target has metadata for a key
 */
export function hasMetadata(key: string, target: MetadataTarget): boolean {
  return Reflect.hasMetadata(key, target);
}

/**
 * Delete metadata for a key from a target
 */
export function deleteMetadata(key: string, target: MetadataTarget): boolean {
  return Reflect.deleteMetadata(key, target);
}

/**
 * Get controller metadata from a target
 */
export function getControllerMetadata(target: MetadataTarget): Record<string, unknown> | undefined {
  if (typeof target === 'object' && target !== null && 'constructor' in target) {
    return getMetadata('controller', target.constructor);
  }
  return getMetadata('controller', target);
}

/**
 * Get route metadata from a target
 */
export function getRouteMetadata(target: MetadataTarget, propertyKey?: string): Record<string, unknown> | undefined {
  if (propertyKey) {
    return Reflect.getMetadata('route', target, propertyKey);
  }
  return getMetadata('route', target);
}

/**
 * Get parameter metadata from a target
 */
export function getParamMetadata(target: MetadataTarget, propertyKey: string): any[] {
  return Reflect.getMetadata('params', target, propertyKey) || [];
}

/**
 * Get middleware metadata from a target
 */
export function getMiddlewareMetadata(target: MetadataTarget, propertyKey?: string): any[] {
  if (propertyKey) {
    return Reflect.getMetadata('middleware', target, propertyKey) || [];
  }
  return Reflect.getMetadata('middleware', target) || [];
}

/**
 * Get hooks metadata from a target
 */
export function getHooksMetadata(target: MetadataTarget, propertyKey?: string): any[] {
  if (propertyKey) {
    return Reflect.getMetadata('hooks', target, propertyKey) || [];
  }
  return Reflect.getMetadata('hooks', target) || [];
}

/**
 * Define controller metadata on a target
 */
export function defineControllerMetadata(metadata: Record<string, unknown>, target: MetadataTarget): void {
  Reflect.defineMetadata(CONTROLLER_METADATA_KEY, metadata, target);
}

/**
 * Define route metadata on a target
 */
export function defineRouteMetadata(metadata: Record<string, unknown>, target: MetadataTarget, propertyKey: string): void {
  Reflect.defineMetadata(ROUTE_METADATA_KEY, metadata, target, propertyKey);
}

/**
 * Get prototype of a target
 */
export function getPrototype(target: MetadataTarget): object {
  if (typeof target === 'function') {
    return target.prototype;
  }
  return Object.getPrototypeOf(target);
}

/**
 * Get constructor of a target
 */
export function getConstructor(target: MetadataTarget): Function {
  if (typeof target === 'object' && target !== null && 'constructor' in target) {
    const constructor = target.constructor;
    return constructor !== Object ? constructor : target as unknown as Function;
  }
  return target as Function;
} 