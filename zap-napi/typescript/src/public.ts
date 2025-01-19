import 'reflect-metadata';
import { Router } from './router';
import { createRouter } from './bindings';
import { JsRequest, JsResponse, RouteHandler, Middleware, Guard, ValidationFn, TransformFn } from './types';

// Re-export everything from decorators
export * from './decorators';

// Export specific types
export type {
  JsRequest,
  JsResponse,
  RouteHandler,
  Middleware,
  Guard,
  ValidationFn,
  TransformFn
};

// Export router and createRouter
export {
  Router,
  createRouter
};

// Helper functions
export function createResponse(status: number, headers: Record<string, string>, body: any): JsResponse {
  return { status, headers, body };
} 