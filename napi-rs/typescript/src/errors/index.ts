import { ErrorResponse, Request, Response } from '../types';

export class RouterError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'RouterError';
    Object.setPrototypeOf(this, RouterError.prototype);
  }

  toResponse(): ErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

export class ValidationError extends RouterError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', 400, message, details);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class NotFoundError extends RouterError {
  constructor(path: string) {
    super('NOT_FOUND', 404, `Route not found: ${path}`);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class UnauthorizedError extends RouterError {
  constructor(message: string = 'Unauthorized') {
    super('UNAUTHORIZED', 401, message);
    this.name = 'UnauthorizedError';
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

export class ForbiddenError extends RouterError {
  constructor(message: string = 'Forbidden') {
    super('FORBIDDEN', 403, message);
    this.name = 'ForbiddenError';
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

export class BadRequestError extends RouterError {
  constructor(message: string = 'Bad request') {
    super('BAD_REQUEST', 400, message);
    this.name = 'BadRequestError';
    Object.setPrototypeOf(this, BadRequestError.prototype);
  }
}

export class InternalError extends RouterError {
  constructor(message: string = 'Internal server error') {
    super('INTERNAL_ERROR', 500, message);
    this.name = 'InternalError';
    Object.setPrototypeOf(this, InternalError.prototype);
  }
}

export class MethodNotAllowedError extends RouterError {
  constructor(method: string, path: string) {
    super('METHOD_NOT_ALLOWED', 405, `Method ${method} not allowed for path: ${path}`);
    this.name = 'MethodNotAllowedError';
    Object.setPrototypeOf(this, MethodNotAllowedError.prototype);
  }
}

// Error utility functions
export function createError(code: string, message: string, statusCode?: number, details?: Record<string, unknown>): RouterError {
  return new RouterError(code, statusCode || 500, message, details);
}

export function createValidationError(message: string, details?: Record<string, unknown>): RouterError {
  return new ValidationError(message, details);
}

export function createNotFoundError(path: string): RouterError {
  return new NotFoundError(path);
}

export function createUnauthorizedError(message?: string): RouterError {
  return new UnauthorizedError(message);
}

export function createForbiddenError(message?: string): RouterError {
  return new ForbiddenError(message);
}

export function createInternalError(message?: string): RouterError {
  return new InternalError(message);
}

export function createBadRequestError(message?: string): RouterError {
  return new BadRequestError(message);
}

export function isRouterError(error: unknown): error is RouterError {
  return error instanceof RouterError;
}

export function createErrorHandler(options: {
  logError?: (error: Error) => void;
  formatError?: (error: RouterError) => ErrorResponse;
}) {
  return async (error: Error, _req: Request): Promise<Response> => {
    // Log error if logger is provided
    if (options.logError) {
      options.logError(error);
    }

    // Convert to RouterError if not already
    const routerError = isRouterError(error)
      ? error
      : new InternalError(error.message);

    // Format error response
    const errorResponse = options.formatError
      ? options.formatError(routerError)
      : routerError.toResponse();

    return {
      status: routerError.statusCode,
      headers: {
        'Content-Type': 'application/json',
      },
      body: errorResponse,
    };
  };
}

export function createErrorMiddleware(options: {
  handleError?: (error: Error, req: Request) => Promise<Response>;
}) {
  return async (req: Request, next: () => Promise<Response>): Promise<Response> => {
    try {
      return await next();
    } catch (error) {
      if (options.handleError) {
        return options.handleError(error instanceof Error ? error : new Error(String(error)), req);
      }
      throw error;
    }
  };
} 