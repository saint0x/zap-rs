/**
 * @fileoverview Type definitions for Zap HTTP Framework
 * @module zap-rs/types
 */

// ============================================================================
// HTTP Types
// ============================================================================

/**
 * Supported HTTP methods
 */
export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "HEAD"
  | "OPTIONS";

/**
 * Log level for the server
 */
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

/**
 * Server configuration options
 */
export interface ZapOptions {
  /** Port to listen on (default: 3000) */
  port?: number;
  /** Hostname to bind to (default: "127.0.0.1") */
  hostname?: string;
  /** Log level for the server (default: "info") */
  logLevel?: LogLevel;
  /** Maximum request body size in bytes (default: 10MB) */
  maxRequestBodySize?: number;
  /** Request timeout in seconds (default: 30) */
  requestTimeoutSecs?: number;
  /** Keep-alive timeout in seconds (default: 5) */
  keepaliveTimeoutSecs?: number;
}

// ============================================================================
// Request Types
// ============================================================================

/**
 * Parsed query parameters from the URL
 */
export type QueryParams = Record<string, string>;

/**
 * Route parameters extracted from the path (e.g., /users/:id -> { id: "123" })
 */
export type RouteParams = Record<string, string>;

/**
 * HTTP headers as key-value pairs
 */
export type Headers = Record<string, string>;

/**
 * Parsed cookies from the Cookie header
 */
export type Cookies = Record<string, string>;

/**
 * IPC request data sent from Rust to TypeScript handlers
 */
export interface IpcRequest {
  /** HTTP method (GET, POST, etc.) */
  method: HttpMethod;
  /** Full path including query string */
  path: string;
  /** Path without query string */
  path_only: string;
  /** Parsed query parameters */
  query: QueryParams;
  /** Route parameters from path patterns */
  params: RouteParams;
  /** HTTP request headers */
  headers: Headers;
  /** Request body as string */
  body: string;
  /** Parsed cookies */
  cookies: Cookies;
}

/**
 * Enhanced request object with helper methods
 */
export interface ZapRequest extends IpcRequest {
  /** Get a specific route parameter */
  param(name: string): string | undefined;
  /** Get a specific query parameter */
  queryParam(name: string): string | undefined;
  /** Get a specific header (case-insensitive) */
  header(name: string): string | undefined;
  /** Get a specific cookie */
  cookie(name: string): string | undefined;
  /** Parse the body as JSON */
  json<T = unknown>(): T;
  /** Get raw body as Buffer */
  buffer(): Buffer;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * HTTP status codes
 */
export type StatusCode = number;

/**
 * Response object that handlers can return
 */
export interface ZapResponse {
  /** HTTP status code (default: 200) */
  status?: StatusCode;
  /** Response headers */
  headers?: Headers;
  /** Response body */
  body?: string | Buffer | object;
}

/**
 * Handler function signature
 * Can return a string, object (JSON), Response, or ZapResponse
 */
export type Handler = (
  request: ZapRequest
) => string | object | Response | ZapResponse | Promise<string | object | Response | ZapResponse>;

/**
 * Internal handler function used by IPC
 */
export type HandlerFunction = (
  req: IpcRequest
) => Promise<{ status: number; headers: Headers; body: string }>;

// ============================================================================
// IPC Types
// ============================================================================

/**
 * IPC message types for Rust <-> TypeScript communication
 */
export type IpcMessageType =
  | "invoke_handler"
  | "handler_response"
  | "health_check"
  | "health_check_response"
  | "error";

/**
 * Base IPC message structure
 */
export interface IpcMessage {
  type: IpcMessageType;
  [key: string]: unknown;
}

/**
 * Handler invocation message from Rust
 */
export interface InvokeHandlerMessage extends IpcMessage {
  type: "invoke_handler";
  handler_id: string;
  request: IpcRequest;
}

/**
 * Handler response message to Rust
 */
export interface HandlerResponseMessage extends IpcMessage {
  type: "handler_response";
  handler_id: string;
  status: number;
  headers: Headers;
  body: string;
}

/**
 * Error message
 */
export interface ErrorMessage extends IpcMessage {
  type: "error";
  code: string;
  message: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Route configuration for Rust server
 */
export interface RouteConfig {
  /** HTTP method */
  method: HttpMethod;
  /** Route path pattern */
  path: string;
  /** Handler identifier */
  handler_id: string;
  /** Whether this is a TypeScript handler */
  is_typescript: boolean;
}

/**
 * Static file serving configuration
 */
export interface StaticFileConfig {
  /** URL prefix for static files */
  prefix: string;
  /** Directory path on filesystem */
  directory: string;
  /** Additional options */
  options?: {
    /** Enable directory listing */
    directoryListing?: boolean;
    /** Cache-Control header value */
    cacheControl?: string;
    /** Custom headers */
    headers?: Headers;
    /** Enable compression */
    compress?: boolean;
  };
}

/**
 * Middleware configuration
 */
export interface MiddlewareConfig {
  /** Enable CORS middleware */
  enable_cors?: boolean;
  /** Enable request logging */
  enable_logging?: boolean;
  /** Enable response compression */
  enable_compression?: boolean;
}

/**
 * Complete server configuration sent to Rust
 */
export interface ZapConfig {
  /** Server port */
  port: number;
  /** Server hostname */
  hostname: string;
  /** IPC socket path */
  ipc_socket_path: string;
  /** Maximum request body size */
  max_request_body_size?: number;
  /** Request timeout in seconds */
  request_timeout_secs?: number;
  /** Keep-alive timeout in seconds */
  keepalive_timeout_secs?: number;
  /** Route configurations */
  routes: RouteConfig[];
  /** Static file configurations */
  static_files: StaticFileConfig[];
  /** Middleware configuration */
  middleware: MiddlewareConfig;
  /** Health check endpoint path */
  health_check_path?: string;
  /** Metrics endpoint path */
  metrics_path?: string;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error codes for Zap errors
 */
export enum ZapErrorCode {
  /** Handler not found */
  HANDLER_NOT_FOUND = "HANDLER_NOT_FOUND",
  /** Handler execution error */
  HANDLER_EXECUTION_ERROR = "HANDLER_EXECUTION_ERROR",
  /** IPC connection error */
  IPC_CONNECTION_ERROR = "IPC_CONNECTION_ERROR",
  /** IPC protocol error */
  IPC_PROTOCOL_ERROR = "IPC_PROTOCOL_ERROR",
  /** Request timeout */
  REQUEST_TIMEOUT = "REQUEST_TIMEOUT",
  /** Server not started */
  SERVER_NOT_STARTED = "SERVER_NOT_STARTED",
  /** Binary not found */
  BINARY_NOT_FOUND = "BINARY_NOT_FOUND",
  /** Configuration error */
  CONFIG_ERROR = "CONFIG_ERROR",
  /** Unknown error */
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

/**
 * Custom error class for Zap errors
 */
export class ZapError extends Error {
  readonly code: ZapErrorCode;
  readonly details?: unknown;

  constructor(code: ZapErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ZapError";
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ZapError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Result type for operations that can fail
 */
export type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

/**
 * Create a successful result
 */
export function ok<T>(value: T): Result<T, never> {
  return { success: true, value };
}

/**
 * Create a failed result
 */
export function err<E>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Type guard to check if a result is successful
 */
export function isOk<T, E>(result: Result<T, E>): result is { success: true; value: T } {
  return result.success;
}

/**
 * Type guard to check if a result is an error
 */
export function isErr<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return !result.success;
}
