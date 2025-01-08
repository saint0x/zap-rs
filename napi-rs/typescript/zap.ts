import { native } from './bindings';
import { RequestContext, ResponseContext, Middleware, Hook } from './types';
export * from './decorators';
export * from './types';

export class Zap {
  private router = native.createRouter();
  private store = native.createStore();
  private hooks = native.createHooks();
  private controllers: any[] = [];

  constructor() {
    this.initializeMetadataReflection();
  }

  private initializeMetadataReflection() {
    if (typeof Reflect === 'undefined' || !Reflect.defineMetadata) {
      throw new Error('Reflect metadata is not available. Please import "reflect-metadata" at the start of your application.');
    }
  }

  // Register a controller class
  register(controllerClass: new (...args: any[]) => any) {
    const controller = new controllerClass();
    this.controllers.push(controller);
    this.registerController(controller);
  }

  private registerController(controller: any) {
    const controllerMetadata = Reflect.getMetadata('zap:controller', controller.constructor);
    if (!controllerMetadata) {
      throw new Error(`Class ${controller.constructor.name} is not decorated with @controller`);
    }

    // Register controller-level middleware
    controllerMetadata.middlewares.forEach((middleware: Middleware) => {
      this.router.addMiddleware(controllerMetadata.path, middleware);
    });

    // Register routes
    for (const methodName of Object.getOwnPropertyNames(Object.getPrototypeOf(controller))) {
      const routeMetadata = Reflect.getMetadata('zap:route', controller, methodName);
      if (routeMetadata) {
        const fullPath = `${controllerMetadata.path}${routeMetadata.path}`;
        
        // Create the route handler
        const handler = async (ctx: RequestContext): Promise<ResponseContext> => {
          // Run pre-handler hooks
          for (const hook of routeMetadata.hooks.filter((h: Hook) => h.phase === 'pre-handler')) {
            await hook.handler(ctx);
          }

          // Run validation if present
          if (routeMetadata.validation) {
            ctx.body = routeMetadata.validation.validate(ctx.body);
          }

          // Call the actual handler
          const result = await controller[methodName].call(controller, ctx);

          // Run post-handler hooks
          for (const hook of routeMetadata.hooks.filter((h: Hook) => h.phase === 'post-handler')) {
            await hook.handler(ctx);
          }

          return result;
        };

        // Register the route with middleware
        this.router.addRoute(routeMetadata.method, fullPath, handler);
        routeMetadata.middlewares.forEach((middleware: Middleware) => {
          this.router.addMiddleware(fullPath, middleware);
        });
      }
    }
  }

  // Handle incoming HTTP request
  async handleRequest(
    method: string,
    path: string,
    headers: Record<string, string> = {},
    body?: unknown
  ): Promise<ResponseContext> {
    return this.router.handleRequest(method, path, headers, body);
  }

  // Store methods
  async store<T>(key: string, value: T): Promise<void> {
    return this.store.set(key, value);
  }

  async retrieve<T>(key: string): Promise<T | null> {
    return this.store.get<T>(key);
  }

  async remove(key: string): Promise<void> {
    return this.store.delete(key);
  }

  async clearStore(): Promise<void> {
    return this.store.clear();
  }

  // Hook methods
  addHook(phase: Hook['phase'], handler: (ctx: RequestContext) => Promise<void>): void {
    this.hooks.addHook(phase, handler);
  }

  removeHook(phase: Hook['phase'], handler: (ctx: RequestContext) => Promise<void>): void {
    this.hooks.removeHook(phase, handler);
  }
}

// Export default instance
export default new Zap(); 