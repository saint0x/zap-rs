/**
 * Core router types
 */

export interface RouterOptions {
  basePath?: string;
  caseSensitive?: boolean;
  strict?: boolean;
  enableLogging?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  logger?: Logger;
}

export interface Request {
  method: string;
  url: string;
  path: string;
  headers: Record<string, string>;
  body?: unknown;
  params: Record<string, string>;
  query: Record<string, string>;
  context: RequestContext;
  ip?: string;
  user?: Record<string, unknown>;
}

export interface Response {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export interface RequestContext {
  id: string;
  timestamp: number;
  metadata: Record<string, unknown>;
  state: Map<string, unknown>;
}

export type RouteHandler = (req: Request) => Promise<Response>;
export type Middleware = (req: Request, next: () => Promise<Response>) => Promise<Response>;
export type ErrorHandler = (error: Error, req: Request) => Promise<Response>;

export interface Hook {
  phase: 'before' | 'after' | 'error';
  handler: (req: Request) => Promise<void>;
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

export interface ValidationError extends Error {
  code: 'VALIDATION_ERROR';
  details: Array<{
    path: string[];
    message: string;
    type: string;
  }>;
}

/**
 * Error types
 */
export interface RouterError extends Error {
  code: string;
  statusCode: number;
  details?: Record<string, unknown>;
  toResponse(): ErrorResponse;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Logging types
 */
export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
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
  [key: string]: any;
}

/**
 * Discovery types
 */
export interface ControllerMetadata {
  path: string;
  routes: RouteMetadata[];
  middlewares: Middleware[];
  hooks: Hook[];
}

export interface RouteMetadata {
  method: string;
  path: string;
  handler: RouteHandler;
  validation?: {
    body?: ValidationSchema;
    query?: ValidationSchema;
    params?: ValidationSchema;
  };
  middlewares: Middleware[];
  hooks: Hook[];
} 