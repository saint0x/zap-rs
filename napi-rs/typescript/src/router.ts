import { Router as IRouter, Request, Response, Middleware, RouterOptions, Logger, RouteMetadata, RouteHandler, Hook, LogLevel, ZapError } from './types';
import { createMiddlewareChain, MiddlewareChain } from './middleware';
import { createLogger } from './logging';
import { getControllerMetadata, getRouteMetadata, getMiddlewareMetadata } from './metadata';
import { RouterError, createNotFoundError } from './errors';

export class Router implements IRouter {
  private middlewareChain: MiddlewareChain;
  private controllers: Map<string, object>;
  private logger: Logger;

  constructor(options: RouterOptions = {}) {
    this.middlewareChain = createMiddlewareChain();
    this.controllers = new Map();
    this.logger = options.logger || createLogger();

    if (options.enableLogging) {
      this.use(async (req, next) => {
        const start = Date.now();
        try {
          const response = await next();
          this.logger.info('Request completed', {
            method: req.method,
            path: req.url,
            status: response.status,
            duration: Date.now() - start,
          });
          return response;
        } catch (error) {
          this.logger.error('Request failed', {
            method: req.method,
            path: req.url,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - start,
          });
          throw error;
        }
      });
    }
  }

  handle(request: Request): Promise<Response> {
    return this.handleRequest(request);
  }

  use(middleware: Middleware): void {
    this.middlewareChain.add(middleware);
  }

  useMiddleware(middleware: Middleware): void {
    this.use(middleware);
  }

  useHook(hook: Hook): void {
    if (hook.phase === 'before' || hook.phase === 'after') {
      this.use(async (req, next) => {
        if (hook.phase === 'before') await hook.handler(req);
        const response = await next();
        if (hook.phase === 'after') await hook.handler(req);
        return response;
      });
    }
  }

  get(path: string, handler: RouteHandler): void {
    this.addRoute('GET', path, handler);
  }

  post(path: string, handler: RouteHandler): void {
    this.addRoute('POST', path, handler);
  }

  put(path: string, handler: RouteHandler): void {
    this.addRoute('PUT', path, handler);
  }

  delete(path: string, handler: RouteHandler): void {
    this.addRoute('DELETE', path, handler);
  }

  patch(path: string, handler: RouteHandler): void {
    this.addRoute('PATCH', path, handler);
  }

  options(path: string, handler: RouteHandler): void {
    this.addRoute('OPTIONS', path, handler);
  }

  head(path: string, handler: RouteHandler): void {
    this.addRoute('HEAD', path, handler);
  }

  setErrorHandler(handler: (error: ZapError) => Promise<Response>): void {
    this.middlewareChain.add(async (req, next) => {
      try {
        return await next();
      } catch (error) {
        const zapError: ZapError = error instanceof Error ? {
          code: 'INTERNAL_ERROR',
          message: error.message,
          details: { stack: error.stack }
        } : {
          code: 'UNKNOWN_ERROR',
          message: String(error),
          details: { error }
        };
        return handler(zapError);
      }
    });
  }

  setLogger(logger: (level: string, message: string) => void): void {
    this.logger = {
      debug: (msg: string) => logger('debug', msg),
      info: (msg: string) => logger('info', msg),
      warn: (msg: string) => logger('warn', msg),
      error: (msg: string) => logger('error', msg),
    };
  }

  registerController(controller: object): void {
    const metadata = getControllerMetadata(controller);
    if (!metadata || typeof metadata !== 'object' || !('path' in metadata)) {
      throw new Error('Invalid controller: missing metadata');
    }

    const path = metadata.path as string;
    this.controllers.set(path, controller);
  }

  async handleRequest(req: Request): Promise<Response> {
    try {
      const response = await this.middlewareChain.execute(req, async () => {
        const controller = this.findController(req.url);
        if (!controller) {
          throw createNotFoundError(`No route found for ${req.method} ${req.url}`);
        }

        const handler = this.findHandler(controller, req);
        if (!handler) {
          throw createNotFoundError(`No handler found for ${req.method} ${req.url}`);
        }

        return handler(req);
      });

      return response;
    } catch (error) {
      if (error instanceof RouterError) {
        return {
          status: error.statusCode,
          headers: { 'Content-Type': 'application/json' },
          body: error.toResponse(),
        };
      }

      return {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: {
          error: {
            message: error instanceof Error ? error.message : String(error),
            code: 'INTERNAL_ERROR',
          },
        },
      };
    }
  }

  private findController(path: string): object | null {
    for (const [prefix, controller] of this.controllers) {
      if (path.startsWith(prefix)) {
        return controller;
      }
    }
    return null;
  }

  private findHandler(controller: object, req: Request): RouteHandler | null {
    const metadata = getControllerMetadata(controller);
    if (!metadata || typeof metadata !== 'object' || !('path' in metadata)) {
      return null;
    }

    const routes = getRouteMetadata(controller, 'route');
    if (!Array.isArray(routes)) {
      return null;
    }

    for (const route of routes) {
      if (!this.isValidRouteMetadata(route)) continue;
      
      const fullPath = `${metadata.path}${route.path}`;
      if (req.url === fullPath && req.method === route.method) {
        return this.createHandler(controller, route);
      }
    }

    return null;
  }

  private isValidRouteMetadata(route: unknown): route is RouteMetadata {
    return (
      typeof route === 'object' &&
      route !== null &&
      'path' in route &&
      'method' in route &&
      typeof route.path === 'string' &&
      typeof route.method === 'string'
    );
  }

  private createHandler(controller: object, route: RouteMetadata): RouteHandler {
    return async (req: Request): Promise<Response> => {
      const middlewares = getMiddlewareMetadata(controller, route.method);
      if (Array.isArray(middlewares)) {
        const chain = createMiddlewareChain(middlewares as Middleware[]);
        return chain.execute(req, () => this.executeHandler(controller, route.method, req));
      }
      return this.executeHandler(controller, route.method, req);
    };
  }

  private async executeHandler(controller: object, method: string, req: Request): Promise<Response> {
    if (typeof controller === 'object' && controller !== null && method in controller) {
      const handler = (controller as Record<string, unknown>)[method];
      if (typeof handler === 'function') {
        const result = await handler.call(controller, req);
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: result,
        };
      }
    }
    throw new Error(`Method ${method} not found on controller`);
  }

  private addRoute(method: string, path: string, handler: RouteHandler): void {
    const route = {
      method,
      path,
      handler,
    };
    this.controllers.set(path, { [method]: handler });
  }
}

export function createRouter(options?: RouterOptions): Router {
  return new Router(options);
} 