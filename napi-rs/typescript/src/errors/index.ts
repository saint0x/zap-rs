import { RouterError, ErrorResponse, Request, Response } from '../types';

export class RouterErrorImpl extends Error implements RouterError {
  code: string;
  statusCode: number;
  details?: Record<string, unknown>;

  constructor(code: string, message: string, statusCode: number = 500, details?: Record<string, unknown>) {
    super(message);
    this.name = 'RouterError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
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

export class ValidationError extends RouterErrorImpl {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class NotFoundError extends RouterErrorImpl {
  constructor(message: string = 'Resource not found') {
    super('NOT_FOUND', message, 404);
  }
}

export class UnauthorizedError extends RouterErrorImpl {
  constructor(message: string = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenError extends RouterErrorImpl {
  constructor(message: string = 'Forbidden') {
    super('FORBIDDEN', message, 403);
  }
}

export class InternalError extends RouterErrorImpl {
  constructor(message: string = 'Internal server error') {
    super('INTERNAL_ERROR', message, 500);
  }
}

export class BadRequestError extends RouterErrorImpl {
  constructor(message: string = 'Bad request') {
    super('BAD_REQUEST', message, 400);
  }
}

export function isRouterError(error: unknown): error is RouterError {
  return error instanceof RouterErrorImpl;
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

// Error utility functions
export function createError(code: string, message: string, statusCode?: number, details?: Record<string, unknown>): RouterError {
  return new RouterErrorImpl(code, message, statusCode, details);
}

export function createValidationError(message: string, details?: Record<string, unknown>): RouterError {
  return new ValidationError(message, details);
}

export function createNotFoundError(message?: string): RouterError {
  return new NotFoundError(message);
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

export { RouterErrorImpl as RouterError }; 