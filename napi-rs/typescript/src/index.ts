// Core exports
export { Router, createRouter } from './router';
export { Request, Response, RouterOptions, RouteHandler, Middleware, Hook } from './types';

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
  header,
  validate,
  catchError,
  cache,
  rateLimit,
} from './decorators';

// Error handling exports
export {
  RouterError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  InternalError,
  BadRequestError,
  createError,
  createValidationError,
  createNotFoundError,
  createUnauthorizedError,
  createForbiddenError,
  createInternalError,
  createBadRequestError,
  isRouterError,
  createErrorHandler,
  createErrorMiddleware,
} from './errors';

// Middleware exports
export {
  MiddlewareChain,
  createMiddlewareChain,
  createCorsMiddleware,
  createBodyParserMiddleware,
  createAuthMiddleware,
  createRateLimitMiddleware,
  createHookMiddleware,
  createValidationMiddleware,
  createCacheMiddleware,
} from './middleware';

// Validation exports
export {
  Validator,
  createValidator,
  ValidationSchema,
  ValidationOptions,
  ValidationError as ValidationSchemaError,
} from './validation';

// Discovery exports
export {
  ControllerDiscovery,
  ControllerInfo,
  RouteInfo,
  createControllerDiscovery,
  getControllerMetadata,
  getRouteMetadata,
  getParamMetadata,
  getValidationMetadata,
  getMiddlewareMetadata,
  getHookMetadata,
  normalizePath,
  matchPath,
  extractPathParams,
  scanControllers,
} from './discovery';

// Logging exports
export {
  Logger,
  LogLevel,
  LoggerOptions,
  RouterLogger,
  createLogger,
  createRequestLogger,
  createErrorLogger,
  createAccessLogger,
  createErrorLoggerWithFormat,
} from './logging';

// Re-export reflect-metadata for convenience
export { default as reflectMetadata } from 'reflect-metadata'; 