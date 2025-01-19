declare module 'zap-napi' {
    export type HandlerId = number;
    export type HookId = number;

    export class Router {
        constructor();
        register(method: string, path: string): HandlerId;
        getHandlerId(method: string, path: string): HandlerId | null;
    }

    export class Hooks {
        constructor();
        registerPreRouting(name: string): HookId;
        registerPostHandler(name: string): HookId;
        registerErrorHandler(name: string): HookId;
        getPreRoutingHooks(): object;
        getPostHandlerHooks(): object;
        getErrorHandlerHooks(): object;
    }

    export function getVersion(): string;
} 