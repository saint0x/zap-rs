export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
export type StatusCode = 200 | 201 | 204 | 400 | 401 | 403 | 404 | 500;

export interface RequestContext {
  params: Record<string, string>;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: unknown;
}

export interface ResponseContext<T = unknown> {
  status?: StatusCode;
  headers?: Record<string, string>;
  body?: T;
}

export type Middleware = (ctx: RequestContext, next: () => Promise<void>) => Promise<void>;

export type RouteHandler = (ctx: RequestContext) => Promise<ResponseContext>;

export type HookPhase = 'pre-routing' | 'post-routing' | 'pre-handler' | 'post-handler';

export type Hook = {
  phase: HookPhase;
  handler: (ctx: RequestContext) => Promise<void>;
};

export type ValidationSchema<T> = {
  validate: (data: unknown) => T;
};

// Type utilities for route parameters
export type ExtractRouteParams<T extends string> = string extends T 
  ? Record<string, string>
  : T extends `${infer Start}:${infer Param}/${infer Rest}`
  ? { [K in Param | keyof ExtractRouteParams<Rest>]: string }
  : T extends `${infer Start}:${infer Param}`
  ? { [K in Param]: string }
  : {};

// Controller metadata types
export interface ControllerMetadata {
  path: string;
  middlewares: Middleware[];
}

export interface RouteMetadata {
  method: HttpMethod;
  path: string;
  middlewares: Middleware[];
  hooks: Hook[];
  validation?: ValidationSchema<unknown>;
}

// Decorator return types
export type ClassDecorator = <T extends { new (...args: any[]): {} }>(target: T) => T;
export type MethodDecorator = (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
export type ParameterDecorator = (target: any, propertyKey: string, parameterIndex: number) => void; 