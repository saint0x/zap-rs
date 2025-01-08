import { Request, Response, RouteHandler, RouterOptions, Middleware, Hook } from './types';

/**
 * Native bindings for the Rust router implementation
 */
declare module 'zap-rs' {
  export interface NativeRouter {
    new(options?: RouterOptions): NativeRouter;
    handle(request: Request): Promise<Response>;
    get(path: string, handler: RouteHandler): void;
    post(path: string, handler: RouteHandler): void;
    put(path: string, handler: RouteHandler): void;
    delete(path: string, handler: RouteHandler): void;
    patch(path: string, handler: RouteHandler): void;
    options(path: string, handler: RouteHandler): void;
    head(path: string, handler: RouteHandler): void;
    useMiddleware(middleware: Middleware): void;
    useHook(hook: Hook): void;
    setErrorHandler(handler: (error: Error) => Promise<Response>): void;
    setLogger(logger: (level: string, message: string) => void): void;
  }

  export interface NativeRequest {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: Buffer;
    params?: Record<string, string>;
    query?: Record<string, string>;
  }

  export interface NativeResponse {
    status: number;
    headers: Record<string, string>;
    body?: Buffer;
  }

  export interface NativeError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  }

  export const createRouter: (options?: RouterOptions) => NativeRouter;
  export const createRequest: (req: NativeRequest) => Request;
  export const createResponse: (res: NativeResponse) => Response;
  export const createError: (err: NativeError) => Error;
}

export * from './types'; 