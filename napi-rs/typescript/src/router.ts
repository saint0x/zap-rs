import { Request, Response, RouterOptions, Middleware, Hook } from './types';
import { RouterError, createNotFoundError, createInternalError } from './errors';
import { MiddlewareChain, createMiddlewareChain } from './middleware';
import { ControllerDiscovery } from './discovery';
import { Logger, createLogger } from './logging';

export class Router {
  private discovery: ControllerDiscovery;
  private middlewareChain: MiddlewareChain;
  private logger: Logger;
  private hooks: Hook[] = [];

  constructor(options: RouterOptions = {}) {
    this.discovery = new ControllerDiscovery();
    this.middlewareChain = createMiddlewareChain();
    this.logger = options.logger || createLogger();
    this.setupErrorHandler();
  }

  private setupErrorHandler(): void {
    this.middlewareChain.setErrorHandler(async (error: Error, req: Request) => {
      await this.executeHooks('error', req);
      
      this.logger.error('Router error', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method,
      });

      if (error instanceof RouterError) {
        return {
          status: error.statusCode,
          headers: { 'Content-Type': 'application/json' },
          body: error.toResponse(),
        };
      }

      const internalError = createInternalError(error.message);
      return {
        status: internalError.statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: internalError.toResponse(),
      };
    });
  }

  use(middleware: Middleware): void {
    this.middlewareChain.use(middleware);
  }

  registerController(controller: any): void {
    this.discovery.registerController(controller, '');
  }

  async handleRequest(req: Request): Promise<Response> {
    const route = this.discovery.findRoute(req.method, req.path);
    if (!route) {
      throw createNotFoundError(`No route found for ${req.method} ${req.path}`);
    }

    return this.middlewareChain.execute(req, async () => {
      try {
        await this.executeHooks('before', req);
        const result = await route.handler(req);
        await this.executeHooks('after', req);

        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: result,
        };
      } catch (error) {
        await this.executeHooks('error', req);
        if (error instanceof RouterError) {
          throw error;
        }
        throw createInternalError(error instanceof Error ? error.message : String(error));
      }
    });
  }

  private async executeHooks(phase: 'before' | 'after' | 'error', req: Request): Promise<void> {
    for (const hook of this.hooks) {
      if (hook.phase === phase) {
        try {
          await hook.handler(req);
        } catch (error) {
          this.logger.error(`Hook error in ${phase} phase`, {
            error: error instanceof Error ? error.message : String(error),
            phase,
          });
        }
      }
    }
  }
}

export function createRouter(options?: RouterOptions): Router {
  return new Router(options);
} 