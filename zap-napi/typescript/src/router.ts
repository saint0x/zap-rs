import { Router as NativeRouter, Hooks, RouteConfig, HandlerInfo } from 'zap-napi';
import { JsRequest, JsResponse, RouteHandler, Middleware } from './types';

export class Router {
  private nativeRouter: NativeRouter;
  private handlers: Map<number, RouteHandler>;
  private hooks: Hooks;

  constructor() {
    this.hooks = new Hooks();
    this.nativeRouter = new NativeRouter(this.hooks);
    this.handlers = new Map();
  }

  async registerRoute(method: string, path: string, handler: RouteHandler, config?: RouteConfig): Promise<void> {
    const handlerId = await this.nativeRouter.register(method, path, config);
    this.handlers.set(handlerId, handler);
  }

  async registerMiddleware(middleware: Middleware): Promise<number> {
    // Adapt the middleware to match the native interface
    const adaptedMiddleware = async (ctx: any) => {
      await middleware(ctx, async () => {});
    };
    return this.nativeRouter.registerMiddleware(adaptedMiddleware);
  }

  async get(path: string, handler: RouteHandler, config?: RouteConfig): Promise<void> {
    await this.registerRoute('GET', path, handler, config);
  }

  async post(path: string, handler: RouteHandler, config?: RouteConfig): Promise<void> {
    await this.registerRoute('POST', path, handler, config);
  }

  async put(path: string, handler: RouteHandler, config?: RouteConfig): Promise<void> {
    await this.registerRoute('PUT', path, handler, config);
  }

  async delete(path: string, handler: RouteHandler, config?: RouteConfig): Promise<void> {
    await this.registerRoute('DELETE', path, handler, config);
  }

  async handle(request: JsRequest): Promise<JsResponse> {
    const result = await this.nativeRouter.getHandlerInfo(request.method, request.uri);
    if (!result) {
      throw new Error(`No handler found for ${request.method} ${request.uri}`);
    }

    const handler = this.handlers.get(result.id);
    if (!handler) {
      throw new Error(`Handler not found for ID ${result.id}`);
    }

    // Apply guards
    const guards = await this.nativeRouter.getGuards(result.id);
    if (guards) {
      for (const guardFn of guards) {
        // Cast the guard function to match our Guard type
        const guard = guardFn as unknown as (req: JsRequest) => Promise<boolean>;
        const allowed = await guard(request);
        if (!allowed) {
          throw new Error('Access denied by guard');
        }
      }
    }

    // Apply middleware
    const middlewareChain = await this.nativeRouter.getMiddlewareChain(result.id);
    if (middlewareChain) {
      for (const middleware of middlewareChain) {
        await middleware(request);
      }
    }

    // Apply validation
    const validation = await this.nativeRouter.getValidation(result.id);
    if (validation) {
      request.body = await validation(request.body);
    }

    // Execute handler
    let response = await handler(request);

    // Apply transform
    const transform = await this.nativeRouter.getTransform(result.id);
    if (transform) {
      response.body = await transform(response.body);
    }

    return response;
  }

  async use(middleware: Middleware): Promise<void> {
    const id = await this.registerMiddleware(middleware);
    // Store middleware ID for later use in route configuration
  }

  async guard(guard: (req: JsRequest) => Promise<boolean>): Promise<void> {
    const adaptedGuard = async (ctx: any) => {
      const allowed = await guard(ctx);
      if (!allowed) {
        throw new Error('Access denied by guard');
      }
    };
    const id = await this.registerMiddleware(adaptedGuard);
    // Store guard ID for later use in route configuration
  }

  async validate(validation: (data: any) => Promise<any>): Promise<void> {
    // Store validation function for later use in route configuration
  }

  async transform(transform: (data: any) => Promise<any>): Promise<void> {
    // Store transform function for later use in route configuration
  }
} 