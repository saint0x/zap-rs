import type {
    JsRequest,
    JsResponse,
    RouteHandler as RouteHandlerType,
    Middleware as MiddlewareType,
    Guard as GuardFnType,
    ValidationFn as ValidationFnType,
    TransformFn as TransformFnType,
    Hook as HookType,
    LogLevel as LogLevelType,
    Logger as LoggerType,
    RouterOptions as RouterOptionsType,
    ZapError as ZapErrorType
} from './types';

import { Router as RouterClass } from './router';
import { zap as zapDecorators } from './decorators';

// Define the zap namespace
export namespace zap {
    // Type definitions
    export type Request = JsRequest;
    export type Response = JsResponse;
    export type Router = RouterClass;
    export type RouteHandler = (req: Request) => Promise<Response>;
    export type Middleware = (req: Request, next: () => Promise<void>) => Promise<void>;
    export type Guard = (req: Request) => Promise<boolean>;
    export type ValidationFn = (data: any) => Promise<any>;
    export type TransformFn = (data: any) => Promise<any>;
    export type Hook = HookType;
    export type LogLevel = LogLevelType;
    export type Logger = LoggerType;
    export type RouterOptions = RouterOptionsType;
    export type ZapError = ZapErrorType;

    // Core functionality
    export const Router = RouterClass;
    export const createRequest = (
        method: string,
        uri: string,
        headers: Record<string, string> = {},
        body: any = null,
        params: Record<string, string> = {},
        query: Record<string, string> = {}
    ): Request => ({
        method,
        uri,
        headers,
        body,
        params,
        query
    });

    export const createResponse = (
        status: number = 200,
        headers: Record<string, string> = {},
        body: any = null,
        redirect?: string
    ): Response => ({
        status,
        headers,
        body,
        redirect
    });

    // Decorators
    export const controller = zapDecorators.controller;
    export const get = zapDecorators.get;
    export const post = zapDecorators.post;
    export const put = zapDecorators.put;
    export const del = zapDecorators.del;
    export const use = zapDecorators.use;
    export const guard = zapDecorators.guard;
    export const validate = zapDecorators.validate;
    export const transform = zapDecorators.transform;
} 