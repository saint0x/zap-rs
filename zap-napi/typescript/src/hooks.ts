import { JsRequest, JsResponse, RouteHandler } from './types';

type HookId = number;
type PreRoutingHook = (request: JsRequest) => Promise<JsRequest> | JsRequest;
type PostHandlerHook = (response: JsResponse) => Promise<JsResponse> | JsResponse;
type ErrorHandlerHook = (error: Error) => Promise<JsResponse> | JsResponse;

class HooksManager {
    private preRoutingHooks = new Map<HookId, PreRoutingHook>();
    private postHandlerHooks = new Map<HookId, PostHandlerHook>();
    private errorHandlerHooks = new Map<HookId, ErrorHandlerHook>();

    registerPreRouting(id: HookId, hook: PreRoutingHook) {
        this.preRoutingHooks.set(id, hook);
    }

    registerPostHandler(id: HookId, hook: PostHandlerHook) {
        this.postHandlerHooks.set(id, hook);
    }

    registerErrorHandler(id: HookId, hook: ErrorHandlerHook) {
        this.errorHandlerHooks.set(id, hook);
    }

    async executePreRouting(request: JsRequest): Promise<JsRequest> {
        let current = request;
        for (const hook of this.preRoutingHooks.values()) {
            current = await Promise.resolve(hook(current));
        }
        return current;
    }

    async executePostHandler(response: JsResponse): Promise<JsResponse> {
        let current = response;
        for (const hook of this.postHandlerHooks.values()) {
            current = await Promise.resolve(hook(current));
        }
        return current;
    }

    async executeErrorHooks(error: Error): Promise<JsResponse> {
        for (const hook of this.errorHandlerHooks.values()) {
            try {
                return await Promise.resolve(hook(error));
            } catch (e) {
                continue; // Try next error handler
            }
        }
        throw error; // No handler successfully processed the error
    }
}

export const hooksManager = new HooksManager(); 