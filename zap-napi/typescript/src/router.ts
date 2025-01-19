// zap-napi/typescript/src/router.ts
import { Router as NativeRouter, Hooks } from 'zap-napi';
import { JsRequest, JsResponse, RouteHandler, Middleware, ErrorHandler, RouteErrorHandler } from './types';

interface RouteInfo {
  handler: RouteHandler;
  path: string;
  method: string;
}

export class Router {
  private nativeRouter: NativeRouter;
  private routes: Map<number, RouteInfo>;
  private hooks: Hooks;
  private nextMiddlewareId: number = 0;
  private middlewares: Map<number, Middleware> = new Map();
  private globalMiddlewares: Middleware[] = [];
  private globalErrorHandler?: ErrorHandler;
  private routeErrorHandlers: Map<string, RouteErrorHandler> = new Map();

  constructor() {
    this.hooks = new Hooks();
    this.nativeRouter = new NativeRouter();
    this.routes = new Map();
  }

  private extractParams(path: string, uri: string): Record<string, string> {
    const params: Record<string, string> = {};
    const pathParts = path.split('/');
    const uriParts = uri.split('/');

    for (let i = 0; i < pathParts.length; i++) {
      if (pathParts[i].startsWith(':')) {
        const paramName = pathParts[i].slice(1);
        params[paramName] = uriParts[i];
      }
    }

    console.log(`[ROUTER] Extracted params from ${uri} using pattern ${path}:`, params);
    return params;
  }

  private buildRouteId(method: string, path: string): number {
    // Simple hash function for route ID generation
    let hash = 0;
    const str = `${method}${path}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  async registerRoute(method: string, path: string, handler: RouteHandler): Promise<void> {
    console.log(`[ROUTER] Registering route: ${method} ${path}`);
    const routeId = this.buildRouteId(method, path);
    console.log(`[ROUTER] Generated route ID: ${routeId}`);
    console.log(`[ROUTER] Current routes:`, Array.from(this.routes.entries()));
    
    try {
      console.log(`[ROUTER] Calling native router register`);
      const nativeId = this.nativeRouter.register(method, path);
      console.log(`[ROUTER] Native router ID: ${nativeId}`);
      
      console.log(`[ROUTER] Setting route in map`);
      this.routes.set(routeId, { handler, path, method });
      console.log(`[ROUTER] Route registered successfully`);
      console.log(`[ROUTER] Updated routes:`, Array.from(this.routes.entries()));
    } catch (error) {
      console.error(`[ROUTER] Failed to register route:`, error);
      throw error;
    }
  }

  async registerMiddleware(middleware: Middleware): Promise<number> {
    const id = this.nextMiddlewareId++;
    this.middlewares.set(id, middleware);
    return id;
  }

  async get(path: string, handler: RouteHandler): Promise<void> {
    await this.registerRoute('GET', path, handler);
  }

  async post(path: string, handler: RouteHandler): Promise<void> {
    await this.registerRoute('POST', path, handler);
  }

  async put(path: string, handler: RouteHandler): Promise<void> {
    await this.registerRoute('PUT', path, handler);
  }

  async delete(path: string, handler: RouteHandler): Promise<void> {
    await this.registerRoute('DELETE', path, handler);
  }

  async options(path: string, handler: RouteHandler): Promise<void> {
    await this.registerRoute('OPTIONS', path, handler);
  }

  async head(path: string, handler: RouteHandler): Promise<void> {
    await this.registerRoute('HEAD', path, handler);
  }

  async handle(request: JsRequest): Promise<JsResponse> {
    console.log(`[ROUTER] Handling request: ${request.method} ${request.uri}`);
    console.log(`[ROUTER] Available routes:`, Array.from(this.routes.entries()));
    
    try {
      // Remove query string from URI for route matching
      const uri = request.uri.split('?')[0];
      console.log(`[ROUTER] URI without query string: ${uri}`);

      // Find route by pattern matching
      const route = Array.from(this.routes.values()).find(info => {
        const pattern = info.path.replace(/:[^/]+/g, '[^/]+');
        const regex = new RegExp(`^${pattern}$`);
        return info.method === request.method && regex.test(uri);
      });

      if (!route) {
        console.log(`[ROUTER] No route info found in map`);
        console.log(`[ROUTER] Available routes:`, Array.from(this.routes.entries()).map(([id, info]) => `${info.method} ${info.path} (${id})`));
        throw new Error(`Handler not found for ${request.method} ${request.uri}`);
      }

      console.log(`[ROUTER] Found route info:`, route);
      // Extract route parameters
      request.params = this.extractParams(route.path, uri);
      console.log(`[ROUTER] Extracted params:`, request.params);

      // Extract query parameters
      const queryString = request.uri.split('?')[1];
      if (queryString) {
        request.query = Object.fromEntries(new URLSearchParams(queryString));
        console.log(`[ROUTER] Extracted query params:`, request.query);
      }

      // Create middleware chain
      const chain = [...this.globalMiddlewares];
      const routeMiddlewares = Array.from(this.middlewares.values());
      chain.push(...routeMiddlewares);
      console.log(`[ROUTER] Middleware chain length:`, chain.length);

      // Execute middleware chain
      let index = 0;
      const next = async (): Promise<void> => {
        if (index < chain.length) {
          console.log(`[ROUTER] Executing middleware ${index + 1}/${chain.length}`);
          const middleware = chain[index++];
          await middleware(request, next);
        }
      };

      // Start middleware chain
      console.log(`[ROUTER] Starting middleware chain`);
      await next();
      console.log(`[ROUTER] Middleware chain completed`);

      // Execute handler
      console.log(`[ROUTER] Executing route handler`);
      const response = await route.handler(request);
      console.log(`[ROUTER] Handler response:`, response);
      return response;
    } catch (error) {
      console.error(`[ROUTER] Error handling request:`, error);
      
      // Check for route-specific error handler
      const routeErrorHandler = this.routeErrorHandlers.get(request.uri.split('?')[0]);
      if (routeErrorHandler) {
        console.log(`[ROUTER] Using route-specific error handler for ${request.uri}`);
        return routeErrorHandler(error instanceof Error ? error : new Error(String(error)), request);
      }

      // Use global error handler if available
      if (this.globalErrorHandler) {
        console.log(`[ROUTER] Using global error handler`);
        return this.globalErrorHandler(error instanceof Error ? error : new Error(String(error)), request);
      }

      // Default error response
      return {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: {
          type: 'Json',
          content: {
            error: {
              code: 'INTERNAL_ERROR',
              message: error instanceof Error ? error.message : String(error)
            }
          }
        }
      };
    }
  }

  async use(middleware: Middleware): Promise<void> {
    this.globalMiddlewares.push(middleware);
  }

  async guard(guard: (req: JsRequest) => Promise<boolean>): Promise<void> {
    const adaptedGuard = async (req: JsRequest, next: () => Promise<void>) => {
      const allowed = await guard(req);
      if (!allowed) {
        throw new Error('Access denied by guard');
      }
      await next();
    };
    this.globalMiddlewares.push(adaptedGuard);
  }

  async validate(validation: (data: any) => Promise<any>): Promise<void> {
    const middleware = async (req: JsRequest, next: () => Promise<void>) => {
      req.body = await validation(req.body);
      await next();
    };
    this.globalMiddlewares.push(middleware);
  }

  async transform(transform: (data: any) => Promise<any>): Promise<void> {
    const middleware = async (req: JsRequest, next: () => Promise<void>) => {
      req.body = await transform(req.body);
      await next();
    };
    this.globalMiddlewares.push(middleware);
  }

  onError(handler: ErrorHandler): void {
    console.log(`[ROUTER] Registering global error handler`);
    this.globalErrorHandler = handler;
  }

  onRouteError(path: string, handler: RouteErrorHandler): void {
    console.log(`[ROUTER] Registering error handler for route: ${path}`);
    this.routeErrorHandlers.set(path, handler);
  }
}