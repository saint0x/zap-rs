import { Middleware, Request, Response, Hook } from '../types';
import { RouterError, createInternalError } from '../errors';

export type NextFunction = () => Promise<Response>;
export type ErrorHandler = (error: Error, req: Request) => Promise<Response>;

export interface MiddlewareContext {
  req: Request;
  next: NextFunction;
}

export class MiddlewareChain {
  private middlewares: Middleware[] = [];
  private errorHandler?: ErrorHandler;

  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  setErrorHandler(handler: ErrorHandler): void {
    this.errorHandler = handler;
  }

  async execute(req: Request, finalHandler: () => Promise<Response>): Promise<Response> {
    let index = 0;
    const middlewareStack = [...this.middlewares];

    const next = async (): Promise<Response> => {
      if (index >= middlewareStack.length) {
        return finalHandler();
      }

      const middleware = middlewareStack[index++];
      try {
        const response = await middleware(req, next);
        return response;
      } catch (error) {
        if (this.errorHandler) {
          return this.errorHandler(error instanceof Error ? error : new Error(String(error)), req);
        }
        throw error;
      }
    };

    try {
      return await next();
    } catch (error) {
      if (this.errorHandler) {
        return this.errorHandler(error instanceof Error ? error : new Error(String(error)), req);
      }
      throw error;
    }
  }
}

export function createMiddlewareChain(): MiddlewareChain {
  return new MiddlewareChain();
}

// Common middleware factories
export function createCorsMiddleware(options: {
  origin?: string | string[];
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
}) {
  const {
    origin = '*',
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    headers = ['Content-Type', 'Authorization'],
    credentials = false,
  } = options;

  return async (req: Request, next: NextFunction): Promise<Response> => {
    if (req.method === 'OPTIONS') {
      return {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': Array.isArray(origin) ? origin.join(',') : origin,
          'Access-Control-Allow-Methods': methods.join(','),
          'Access-Control-Allow-Headers': headers.join(','),
          'Access-Control-Allow-Credentials': credentials.toString(),
        },
        body: null,
      };
    }

    const response = await next();
    response.headers = {
      ...response.headers,
      'Access-Control-Allow-Origin': Array.isArray(origin) ? origin.join(',') : origin,
      'Access-Control-Allow-Credentials': credentials.toString(),
    };

    return response;
  };
}

export function createBodyParserMiddleware() {
  return async (req: Request, next: NextFunction): Promise<Response> => {
    if (req.body && typeof req.body === 'string') {
      try {
        req.body = JSON.parse(req.body);
      } catch (error) {
        throw createInternalError('Failed to parse request body as JSON');
      }
    }
    return next();
  };
}

export function createAuthMiddleware(options: {
  authenticate: (req: Request) => Promise<boolean | Record<string, unknown>>;
  unauthorized?: () => RouterError;
}) {
  return async (req: Request, next: NextFunction): Promise<Response> => {
    const result = await options.authenticate(req);
    
    if (!result) {
      const error = options.unauthorized?.() || createInternalError('Unauthorized');
      error.code = 'UNAUTHORIZED';
      throw error;
    }

    if (typeof result === 'object') {
      req.user = result;
    }

    return next();
  };
}

export function createRateLimitMiddleware(options: {
  windowMs?: number;
  max?: number;
  keyGenerator?: (req: Request) => string;
  handler?: (req: Request) => Promise<Response>;
}) {
  const {
    windowMs = 60000,
    max = 100,
    keyGenerator = (req) => req.ip || 'unknown',
    handler = async () => ({
      status: 429,
      headers: { 'Content-Type': 'application/json' },
      body: { error: 'Too many requests' },
    }),
  } = options;

  const hits = new Map<string, { count: number; resetTime: number }>();

  return async (req: Request, next: NextFunction): Promise<Response> => {
    const key = keyGenerator(req);
    const now = Date.now();
    
    let record = hits.get(key);
    
    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + windowMs };
      hits.set(key, record);
    }
    
    record.count++;
    
    if (record.count > max) {
      return handler(req);
    }
    
    return next();
  };
}

export function createHookMiddleware(hook: Hook) {
  return async (req: Request, next: NextFunction): Promise<Response> => {
    if (hook.phase === 'before') {
      await hook.handler(req);
    }

    const response = await next();

    if (hook.phase === 'after') {
      await hook.handler(req);
    }

    return response;
  };
}

export function createValidationMiddleware(validate: (req: Request) => Promise<void>) {
  return async (req: Request, next: NextFunction): Promise<Response> => {
    await validate(req);
    return next();
  };
}

export function createCacheMiddleware(options: {
  store?: Map<string, { value: any; expires: number }>;
  keyGenerator?: (req: Request) => string;
  maxAge?: number;
}) {
  const {
    store = new Map(),
    keyGenerator = (req) => `${req.method}:${req.path}`,
    maxAge = 60000,
  } = options;

  return async (req: Request, next: NextFunction): Promise<Response> => {
    const key = keyGenerator(req);
    const now = Date.now();
    const cached = store.get(key);

    if (cached && cached.expires > now) {
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: cached.value,
      };
    }

    const response = await next();
    store.set(key, { value: response.body, expires: now + maxAge });
    return response;
  };
} 