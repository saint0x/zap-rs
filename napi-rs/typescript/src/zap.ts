import { createRouter, createStore, createHooks } from './bindings';
import { Request, Response, Middleware, Hook } from './types';
export * from './decorators';
export * from './types';

export class Zap {
  private router = createRouter();
  private dataStore = createStore();
  private hooks = createHooks();
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
      this.router.use(middleware);
    });

    // Register routes
    for (const methodName of Object.getOwnPropertyNames(Object.getPrototypeOf(controller))) {
      const routeMetadata = Reflect.getMetadata('zap:route', controller, methodName);
      if (routeMetadata) {
        const fullPath = `${controllerMetadata.path}${routeMetadata.path}`;
        
        // Create the route handler
        const handler = async (req: Request): Promise<Response> => {
          // Run before hooks
          for (const hook of routeMetadata.hooks.filter((h: Hook) => h.phase === 'before')) {
            await hook.handler(req);
          }

          // Run validation if present
          if (routeMetadata.validation && req.body) {
            req.body = await routeMetadata.validation.validate(req.body);
          }

          // Call the actual handler
          const result = await controller[methodName].call(controller, req);

          // Run after hooks
          for (const hook of routeMetadata.hooks.filter((h: Hook) => h.phase === 'after')) {
            await hook.handler(req);
          }

          return result;
        };

        // Register the route with middleware
        switch (routeMetadata.method) {
          case 'GET':
            this.router.get(fullPath, handler);
            break;
          case 'POST':
            this.router.post(fullPath, handler);
            break;
          case 'PUT':
            this.router.put(fullPath, handler);
            break;
          case 'DELETE':
            this.router.delete(fullPath, handler);
            break;
          case 'PATCH':
            this.router.patch(fullPath, handler);
            break;
          case 'OPTIONS':
            this.router.options(fullPath, handler);
            break;
          case 'HEAD':
            this.router.head(fullPath, handler);
            break;
        }

        // Register route-level middleware
        routeMetadata.middlewares.forEach((middleware: Middleware) => {
          this.router.use(middleware);
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
  ): Promise<Response> {
    const request: Request = {
      method,
      path,
      url: path,
      headers,
      body: typeof body === 'string' ? body : JSON.stringify(body),
      params: {},
      query: {},
      context: {
        id: Math.random().toString(36).substring(7),
        timestamp: Date.now(),
        metadata: {},
        state: new Map()
      },
      ip: headers['x-forwarded-for'] || headers['x-real-ip']
    };
    return this.router.handleRequest(request);
  }

  // Store methods
  async store<T>(key: string, value: T): Promise<void> {
    return this.dataStore.set(key, value);
  }

  async retrieve<T>(key: string): Promise<T | null> {
    return this.dataStore.get<T>(key);
  }

  async remove(key: string): Promise<void> {
    return this.dataStore.delete(key);
  }

  async clearStore(): Promise<void> {
    return this.dataStore.clear();
  }

  // Hook methods
  addHook(phase: Hook['phase'], handler: (req: Request) => Promise<void>): void {
    this.hooks.addHook({ phase, handler });
  }

  removeHook(phase: Hook['phase'], handler: (req: Request) => Promise<void>): void {
    this.hooks.removeHook({ phase, handler });
  }
}

// Export default instance
export default new Zap(); 