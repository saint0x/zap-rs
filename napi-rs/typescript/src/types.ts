/**
 * Core router types
 */

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

export interface Router {
  // Core functionality
  registerController(controller: any): void;
  handleRequest(request: Request): Promise<Response>;
  handle(request: Request): Promise<Response>;

  // Middleware and hooks
  use(middleware: Middleware): void;
  useMiddleware(middleware: Middleware): void;
  useHook(hook: Hook): void;

  // Route handlers
  get(path: string, handler: RouteHandler): void;
  post(path: string, handler: RouteHandler): void;
  put(path: string, handler: RouteHandler): void;
  delete(path: string, handler: RouteHandler): void;
  patch(path: string, handler: RouteHandler): void;
  options(path: string, handler: RouteHandler): void;
  head(path: string, handler: RouteHandler): void;

  // Error handling and logging
  setErrorHandler(handler: (error: ZapError) => Promise<Response>): void;
  setLogger(logger: (level: string, message: string) => void): void;
}

export interface ZapError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface Request {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string | Record<string, unknown>;
  path?: string;
  query?: Record<string, string>;
  params?: Record<string, string>;
  user?: any;
  ip?: string;
  context?: RequestContext;
}

export interface Response {
  status: number;
  headers: Record<string, string>;
  body?: string | Record<string, unknown> | ErrorResponse;
}

export interface ZapError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface RequestContext {
  id: string;
  timestamp: number;
  metadata: Record<string, unknown>;
  state: Map<string, unknown>;
}

export interface RouteParams {
  pathParams: Record<string, string>;
  queryParams: Record<string, string>;
}

export interface ControllerMetadata {
  path: string;
}

export interface RouteMetadata {
  method: string;
  path: string;
}

export interface Store {
  set<T>(key: string, value: T): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface Hooks {
  addPreRouting(handler: (request: Request) => Promise<Request>): void;
  addPostHandler(handler: (response: Response) => Promise<Response>): void;
  addErrorHandler(handler: (error: ZapError) => Promise<Response>): void;
}

export type RouteHandler = (request: Request) => Promise<Response>;
export type Middleware = (request: Request, next: () => Promise<Response>) => Promise<Response>;
export type Hook = {
  phase: 'before' | 'after' | 'error';
  handler: (request: Request) => Promise<void>;
};

export interface RouteInfo {
  handler: RouteHandler;
  params: Record<string, string>;
}

/**
 * Validation types
 */
export interface ValidationSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  properties?: Record<string, ValidationSchema>;
  items?: ValidationSchema;
  required?: string[];
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
}

export interface ValidationOptions {
  abortEarly?: boolean;
  allowUnknown?: boolean;
  stripUnknown?: boolean;
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'VALIDATION_ERROR',
    public readonly statusCode: number = 400,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ValidationError';
  }

  toResponse(): Response {
    return {
      status: this.statusCode,
      headers: { 'content-type': 'application/json' },
      body: {
        error: {
          code: this.code,
          message: this.message,
          details: this.details
        }
      }
    };
  }
}

/**
 * Logging types
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface LoggerOptions {
  level?: LogLevel;
  format?: string;
  timestamp?: boolean;
  colors?: boolean;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  method?: string;
  path?: string;
  status?: number;
  duration?: number;
  name?: string;
  stack?: string;
  [key: string]: unknown;
}

/**
 * CORS types
 */
export interface CorsOptions {
  origin?: string | string[];
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
  maxAge?: number;
  exposedHeaders?: string[];
  optionsSuccessStatus?: number;
}

/**
 * Controller and Route Metadata types
 */
export interface ControllerMetadata {
  path: string;
  middlewares?: Middleware[];
  hooks?: Hook[];
  options?: Record<string, unknown>;
}

export interface RouteMetadata {
  path: string;
  method: string;
  middlewares?: Middleware[];
  hooks?: Hook[];
  validation?: ValidationSchema;
  options?: Record<string, unknown>;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
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

  toResponse(): ErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details
      }
    };
  }
} 