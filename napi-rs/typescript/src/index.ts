// Core exports
export { Zap } from './zap';
export { createRouter, createStore, createHooks } from './bindings';
export { Server } from './server';

// Type exports
export type {
  Request,
  Response,
  RouterOptions,
  RouteHandler,
  Middleware,
  Hook,
  ValidationSchema,
  ValidationOptions,
  Logger,
  LoggerOptions,
  LogLevel,
  LogEntry,
  CorsOptions,
  Router
} from './types';

// Error exports
export { ValidationError } from './types';
export type { RouterError } from './types';

// Decorator exports
export {
  controller,
  get,
  post,
  put,
  del,
  patch,
  options,
  head,
  use,
  hook,
  param,
  query,
  body,
  validate
} from './decorators';

// Validation exports
export {
  validateQuery,
  validateParams
} from './validation/decorators';

// Middleware exports
export {
  createCorsMiddleware,
  createBodyParserMiddleware,
  createAuthMiddleware,
  createRateLimitMiddleware,
  createValidationMiddleware
} from './middleware';

// Logging exports
export {
  createLogger,
  createRequestLogger
} from './logging';

// Version export
export const VERSION = '1.0.0'; 