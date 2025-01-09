import { Middleware, Request, Response, Hook, CorsOptions } from '../types';
import { RouterError, createInternalError } from '../errors';

export type NextFunction = () => Promise<Response>;
export type ErrorHandler = (error: Error, req: Request) => Promise<Response>;

export interface MiddlewareContext {
  req: Request;
  next: NextFunction;
}

export class MiddlewareChain {
  private middlewares: Middleware[] = [];

  add(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  async execute(req: Request, handler: () => Promise<Response>): Promise<Response> {
    let index = 0;

    const next = async (): Promise<Response> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        return middleware(req, next);
      }
      return handler();
    };

    return next();
  }
}

export function createMiddlewareChain(middlewares: Middleware[] = []): MiddlewareChain {
  const chain = new MiddlewareChain();
  middlewares.forEach(middleware => chain.add(middleware));
  return chain;
}

// Common middleware factories
export function createCorsMiddleware(options: CorsOptions = {}): Middleware {
  const {
    origin = '*',
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    headers = ['Content-Type', 'Authorization'],
  } = options;

  const originValue = Array.isArray(origin) ? origin.join(', ') : origin;

  return async (req: Request, next: NextFunction): Promise<Response> => {
    if (req.method === 'OPTIONS') {
      return {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': originValue,
          'Access-Control-Allow-Methods': methods.join(', '),
          'Access-Control-Allow-Headers': headers.join(', '),
        },
        body: undefined
      };
    }

    const response = await next();
    response.headers = response.headers || {};
    response.headers['Access-Control-Allow-Origin'] = originValue;
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
    try {
      const result = await options.authenticate(req);
      
      if (!result) {
        const error = options.unauthorized?.() || createInternalError('Unauthorized');
        error.code = 'UNAUTHORIZED';
        error.statusCode = 401;
        Object.setPrototypeOf(error, RouterError.prototype);
        throw error;
      }

      if (typeof result === 'object') {
        req.user = result;
      }

      return next();
    } catch (error) {
      if (error instanceof Error) {
        if ('code' in error && error.code === 'UNAUTHORIZED') {
          throw error;
        }
        const authError = createInternalError('Unauthorized');
        authError.code = 'UNAUTHORIZED';
        authError.statusCode = 401;
        Object.setPrototypeOf(authError, RouterError.prototype);
        throw authError;
      }
      const authError = createInternalError('Unauthorized');
      authError.code = 'UNAUTHORIZED';
      authError.statusCode = 401;
      Object.setPrototypeOf(authError, RouterError.prototype);
      throw authError;
    }
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
      body: {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
          details: { retryAfter: windowMs }
        }
      }
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