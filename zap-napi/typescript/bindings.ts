import { RequestContext, ResponseContext } from './types';

interface NativeRouter {
  addRoute(method: string, path: string, handler: (ctx: RequestContext) => Promise<ResponseContext>): void;
  addMiddleware(path: string, middleware: (ctx: RequestContext, next: () => Promise<void>) => Promise<void>): void;
  handleRequest(method: string, path: string, headers: Record<string, string>, body: unknown): Promise<ResponseContext>;
}

interface NativeStore {
  set(key: string, value: unknown): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

interface NativeHooks {
  addHook(phase: string, handler: (ctx: RequestContext) => Promise<void>): void;
  removeHook(phase: string, handler: (ctx: RequestContext) => Promise<void>): void;
}

export interface ZapNative {
  createRouter(): NativeRouter;
  createStore(): NativeStore;
  createHooks(): NativeHooks;
}

declare global {
  var __zap_native: ZapNative;
}

export const native = globalThis.__zap_native; 