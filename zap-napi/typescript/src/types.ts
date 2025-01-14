/**
 * Core router types
 */

import { ValidationSchema as BaseValidationSchema } from './validation';

// Use the web standard Response type from lib.dom.d.ts
export interface RouterOptions {
  basePath?: string;
  caseSensitive?: boolean;
  strict?: boolean;
  enableLogging?: boolean;
  logLevel?: LogLevel;
  logger?: Logger;
  port?: number;
  host?: string;
  middleware?: Middleware[];
  hooks?: Hook[];
}

// Basic Types
export interface JsRequest {
  method: string;
  uri: string;
  headers: Record<string, string>;
  body: any;
  params?: Record<string, string>;
  query?: Record<string, string>;
}

export type ResponseBody = {
  type: 'Json';
  content: Record<string, unknown>;
} | {
  type: 'Text';
  content: string;
} | {
  type: 'Binary';
  content: Uint8Array;
};

export interface JsResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
  redirect?: string;
}

// Handler Types
export type RouteHandler = (request: JsRequest) => Promise<JsResponse>;
export type ErrorHandler = (error: Error) => Promise<JsResponse>;
export type NextFunction = () => Promise<JsResponse>;
export type Middleware = (request: JsRequest, next: () => Promise<void>) => Promise<void>;
export type Hook = {
  phase: 'before' | 'after' | 'error';
  handler: (request: JsRequest) => Promise<void>;
};

// Router Interface
export interface Router {
  handle(request: JsRequest): Promise<JsResponse>;
  get(path: string, handler: RouteHandler): void;
  post(path: string, handler: RouteHandler): void;
  put(path: string, handler: RouteHandler): void;
  delete(path: string, handler: RouteHandler): void;
  pre(hook: (req: JsRequest) => Promise<JsRequest> | JsRequest): void;
  postHook(hook: (res: JsResponse) => Promise<JsResponse> | JsResponse): void;
  error(hook: (err: Error) => Promise<JsResponse> | JsResponse): void;
}

// Error Types
export interface ZapError {
  code: string;
  details?: any;
}

// Context Types
export interface RequestContext {
  request: JsRequest;
  response?: JsResponse;
  error?: ZapError;
}

// Type Guards
export function isJsonResponse(body: ResponseBody): body is { type: 'Json'; content: Record<string, unknown> } {
  return body.type === 'Json';
}

export function isTextResponse(body: ResponseBody): body is { type: 'Text'; content: string } {
  return body.type === 'Text';
}

export function isBinaryResponse(body: ResponseBody): body is { type: 'Binary'; content: Uint8Array } {
  return body.type === 'Binary';
}

export function parseResponseBody<T>(response: JsResponse): T | undefined {
  if (!response.body) {
    return undefined;
  }

  switch (response.body.type) {
    case 'Text':
      return response.body.content as unknown as T;
    case 'Json':
      return response.body.content as T;
    case 'Binary':
      return response.body.content as unknown as T;
    default:
      return undefined;
  }
}

export enum LogLevel {
  Debug = 'debug',
  Info = 'info',
  Warn = 'warn',
  Error = 'error'
}

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export interface LoggerOptions {
  level?: LogLevel;
  format?: string;
  timestamp?: boolean;
  colors?: boolean;
}

export interface LogEntry {
  timestamp: number;
  level: string;
  message: string;
  error?: Error;
  [key: string]: unknown;
}

export interface CorsOptions {
  origin?: string | string[];
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
  maxAge?: number;
  exposedHeaders?: string[];
  optionsSuccessStatus?: number;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  [key: string]: unknown;
}

export class RouterError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'ROUTER_ERROR',
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'RouterError';
  }

  toResponse(): JsResponse {
    return {
      status: this.statusCode,
      headers: { 'content-type': 'application/json' },
      body: {
        type: 'Json',
        content: {
          error: {
            code: this.code,
            message: this.message,
            details: this.details
          }
        }
      }
    };
  }
}

// Metadata types
export interface ParamMetadata {
  index: number;
  type: 'body' | 'query' | 'path' | 'header';
  name?: string;
}

export interface RouteMetadata {
  path: string;
  method: string;
  handler: Function;
  params: ParamMetadata[];
  middlewares?: string[];
  hooks?: string[];
}

export interface ControllerMetadata {
  path: string;
  routes: RouteMetadata[];
  middlewares?: string[];
}

// HTTP Types
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
export type StatusCode = 200 | 201 | 204 | 400 | 401 | 403 | 404 | 500;

// Request/Response Types
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

// Parameter Extraction
export type ExtractRouteParams<T extends string> = string extends T 
    ? Record<string, string>
    : T extends `${infer Start}:${infer Param}/${infer Rest}`
    ? { [K in Param | keyof ExtractRouteParams<Rest>]: string }
    : T extends `${infer Start}:${infer Param}`
    ? { [K in Param]: string }
    : {};

// Metadata Types
export interface MetadataParam {
    index: number;
    type: 'body' | 'query' | 'path' | 'header';
    name?: string;
}

export interface RouteMetadata {
    path: string;
    method: string;
    handler: Function;
    params: MetadataParam[];
    middlewares?: string[];
    hooks?: string[];
}

export interface ControllerMetadata {
    path: string;
    routes: RouteMetadata[];
    middlewares?: string[];
}

// Decorator Types
export type ClassDecorator = <T extends { new (...args: any[]): {} }>(target: T) => T;
export type MethodDecorator = (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
export type ParameterDecorator = (target: any, propertyKey: string, parameterIndex: number) => void;

export interface DecoratorContext {
    target: any;
    propertyKey?: string;
    descriptor?: PropertyDescriptor;
    parameterIndex?: number;
}

export type ControllerDecorator = (path: string) => ClassDecorator;
export type RouteDecorator = (path: string) => MethodDecorator;
export type ParamDecorator = (name?: string) => ParameterDecorator;

// Native Bindings
export interface NativeBindings {
    // Store
    set(key: string, value: unknown): Promise<void>;
    get(key: string): Promise<unknown>;
    delete(key: string): Promise<void>;
    clear(): Promise<void>;
    has(key: string): Promise<boolean>;

    // Router
    register_route(path: string, handler: Function): Promise<void>;
    handle_request(path: string, request: unknown): Promise<void>;
    remove_route(path: string): Promise<void>;
    clear_routes(): Promise<void>;

    // Metadata
    register_controller(name: string, basePath: string): Promise<void>;
    register_route_metadata(
        controller: string,
        route: string,
        method: string,
        handler: Function,
        params: MetadataParam[]
    ): Promise<void>;
    get_route_metadata(controller: string, route: string): Promise<RouteMetadata | null>;
    get_controller_metadata(controller: string): Promise<ControllerMetadata | null>;
}

export type Guard = (request: JsRequest) => Promise<boolean>;
export type ValidationFn = (data: any) => Promise<any>;
export type TransformFn = (data: any) => Promise<any>;

export interface HandlerInfo {
  id: number;
  params: Record<string, string>;
}

// This interface matches the native RouteConfig from zap-napi
export interface RouteConfig {
  guards?: number[];
  middleware?: number[];
  validation?: number;
  transform?: number;
} 