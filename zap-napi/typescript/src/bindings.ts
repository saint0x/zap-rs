declare module 'zap-napi' {
  export interface RouteParams {
    params: { [key: string]: string };
  }

  export interface HandlerInfo {
    id: number;
    params: RouteParams;
  }

  export interface RouteConfig {
    middleware?: number[];
    guards?: number[];
    validation?: (data: any) => Promise<any>;
    transform?: (data: any) => Promise<any>;
  }

  export class Hooks {
    constructor();
    registerPreRouting(name: string): Promise<number>;
    registerPostHandler(name: string): Promise<number>;
    registerErrorHandler(name: string): Promise<number>;
    getPreRoutingHooks(env: any): Promise<any>;
    getPostHandlerHooks(env: any): Promise<any>;
    getErrorHandlerHooks(env: any): Promise<any>;
  }

  export class Router {
    constructor(hooks: Hooks);
    register(method: string, path: string, config?: RouteConfig): Promise<number>;
    registerMiddleware(middleware: (ctx: any) => Promise<void>): Promise<number>;
    getHandlerInfo(method: string, path: string): Promise<HandlerInfo | null>;
    getMiddlewareChain(handlerId: number): Promise<((ctx: any) => Promise<void>)[] | null>;
    getGuards(handlerId: number): Promise<((ctx: any) => Promise<void>)[] | null>;
    getValidation(handlerId: number): Promise<((data: any) => Promise<any>) | null>;
    getTransform(handlerId: number): Promise<((data: any) => Promise<any>) | null>;
  }

  export function getVersion(): string;
} 