

export interface Request {
  /** HTTP method (GET, POST, etc.) */
  method: string;
  /** Full request path including query string */
  path: string;
  /** Path without query string */
  path_only: string;
  /** HTTP version */
  version: string;
  /** Request headers as key-value pairs */
  headers: Record<string, string>;
  /** Request body as UTF-8 string */
  body: string;
  /** Route parameters (e.g., from "/users/:id") */
  params: Record<string, string>;
  /** Query string parameters */
  query: Record<string, string>;
  /** Request cookies */
  cookies: Record<string, string>;
}

export interface ResponseOptions {
  /** HTTP status code */
  status?: number;
  /** Response headers */
  headers?: Record<string, string>;
}

export interface StaticFileOptions {
  /** Enable directory listing */
  directory_listing?: boolean;
  /** Cache control header */
  cache_control?: string;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Enable compression */
  compress?: boolean;
}

/** Sync handler that returns a string */
export type SyncHandler = () => string;

/** Async handler that returns a Promise<string> */
export type AsyncHandler = (req: Request) => Promise<string>;

/** JSON handler that returns any serializable value */
export type JsonHandler = (req: Request) => any;

/** Async JSON handler that returns a Promise of any serializable value */
export type AsyncJsonHandler = (req: Request) => Promise<any>;

/**
 * Main Zap server class - ultra-fast HTTP server for Node.js
 * 
 * @example
 * ```typescript
 * import { Zap } from '@zapjs/core';
 * 
 * const server = new Zap();
 * await server.port(3000);
 * await server.get('/', () => 'Hello, World!');
 * await server.listen();
 * ```
 */
export class Zap {
  /** Create a new Zap server instance */
  constructor();

  /** Set the server port */
  port(port: number): Promise<void>;

  /** Set the server hostname */
  hostname(hostname: string): Promise<void>;

  /** Set maximum request body size in bytes */
  max_request_body_size(size: number): Promise<void>;

  /** Enable CORS middleware */
  cors(): Promise<void>;

  /** Enable logging middleware */
  logging(): Promise<void>;

  /** 
   * Register a GET route with a simple string handler
   * 
   * @example
   * ```typescript
   * await server.get('/', () => 'Hello, World!');
   * ```
   */
  get(path: string, handler: SyncHandler): Promise<void>;

  /** 
   * Register a GET route with an async handler
   * 
   * @example
   * ```typescript
   * await server.get_async('/users/:id', async (req) => {
   *   const id = req.params.id;
   *   return `User ${id}`;
   * });
   * ```
   */
  get_async(path: string, handler: AsyncHandler): Promise<void>;

  /** 
   * Register a GET route that returns JSON
   * 
   * @example
   * ```typescript
   * await server.get_json('/api/users/:id', (req) => {
   *   return { id: req.params.id, name: 'John Doe' };
   * });
   * ```
   */
  get_json(path: string, handler: JsonHandler): Promise<void>;

  /** 
   * Register a POST route with an async handler
   * 
   * @example
   * ```typescript
   * await server.post('/api/users', async (req) => {
   *   // Process req.body
   *   return 'User created';
   * });
   * ```
   */
  post(path: string, handler: AsyncHandler): Promise<void>;

  /** 
   * Register a POST route that returns JSON
   * 
   * @example
   * ```typescript
   * await server.post_json('/api/users', (req) => {
   *   return { message: 'User created', id: 123 };
   * });
   * ```
   */
  post_json(path: string, handler: JsonHandler): Promise<void>;

  /** Register a PUT route */
  put(path: string, handler: AsyncHandler): Promise<void>;

  /** Register a DELETE route */
  delete(path: string, handler: AsyncHandler): Promise<void>;

  /** 
   * Serve static files from a directory
   * 
   * @example
   * ```typescript
   * await server.static_files('/assets', './public');
   * await server.static_files('/downloads', './files', {
   *   directory_listing: true,
   *   cache_control: 'no-cache'
   * });
   * ```
   */
  static_files(prefix: string, directory: string, options?: StaticFileOptions): Promise<void>;

  /** 
   * Add a health check endpoint
   * 
   * @example
   * ```typescript
   * await server.health_check('/health');
   * ```
   */
  health_check(path: string): Promise<void>;

  /** 
   * Add a metrics endpoint
   * 
   * @example
   * ```typescript
   * await server.metrics('/metrics');
   * ```
   */
  metrics(path: string): Promise<void>;

  /** 
   * Start the server and listen for connections
   * 
   * @example
   * ```typescript
   * console.log('🚀 Server running on http://localhost:3000');
   * await server.listen();
   * ```
   */
  listen(): Promise<void>;
}

/**
 * Utility functions for JSON processing and more
 */
export namespace utils {
  /** Parse JSON string to JavaScript object */
  export function parse_json(json_str: string): any;

  /** Stringify JavaScript object to JSON */
  export function stringify_json(value: any): string;

  /** Get current timestamp in milliseconds */
  export function now(): number;
}

/**
 * Type-safe route parameter extraction
 * 
 * @example
 * ```typescript
 * // For route "/users/:id/posts/:postId"
 * type UserPostParams = {
 *   id: string;
 *   postId: string;
 * };
 * 
 * await server.get_json('/users/:id/posts/:postId', (req) => {
 *   const { id, postId } = req.params as UserPostParams;
 *   return { userId: id, postId };
 * });
 * ```
 */
export type RouteParams<T extends string> = 
  T extends `${infer _Start}:${infer Param}/${infer Rest}`
    ? { [K in Param]: string } & RouteParams<Rest>
    : T extends `${infer _Start}:${infer Param}`
    ? { [K in Param]: string }
    : {};

/**
 * Enhanced request with typed parameters
 */
export interface TypedRequest<T extends string = any> extends Request {
  params: RouteParams<T>;
}

/**
 * Type-safe handler with route parameter inference
 */
export type TypedHandler<T extends string> = (req: TypedRequest<T>) => any;
export type TypedAsyncHandler<T extends string> = (req: TypedRequest<T>) => Promise<any>;

/**
 * Create a new Zap server with fluent builder pattern
 * 
 * @example
 * ```typescript
 * import { createServer } from '@zapjs/core';
 * 
 * const server = createServer()
 *   .port(3000)
 *   .cors()
 *   .logging()
 *   .get('/', () => 'Hello, World!')
 *   .listen();
 * ```
 */
export function createServer(): ZapBuilder;

/**
 * Fluent builder interface for creating servers
 */
export interface ZapBuilder {
  /** Set the server port */
  port(port: number): ZapBuilder;
  
  /** Set the server hostname */
  hostname(hostname: string): ZapBuilder;
  
  /** Set maximum request body size */
  max_request_body_size(size: number): ZapBuilder;
  
  /** Enable CORS middleware */
  cors(): ZapBuilder;
  
  /** Enable logging middleware */
  logging(): ZapBuilder;
  
  /** Register a GET route */
  get(path: string, handler: SyncHandler): ZapBuilder;
  
  /** Register an async GET route */
  get_async(path: string, handler: AsyncHandler): ZapBuilder;
  
  /** Register a JSON GET route */
  get_json(path: string, handler: JsonHandler): ZapBuilder;
  
  /** Register a POST route */
  post(path: string, handler: AsyncHandler): ZapBuilder;
  
  /** Register a JSON POST route */
  post_json(path: string, handler: JsonHandler): ZapBuilder;
  
  /** Register a PUT route */
  put(path: string, handler: AsyncHandler): ZapBuilder;
  
  /** Register a DELETE route */
  delete(path: string, handler: AsyncHandler): ZapBuilder;
  
  /** Serve static files */
  static_files(prefix: string, directory: string, options?: StaticFileOptions): ZapBuilder;
  
  /** Add health check */
  health_check(path: string): ZapBuilder;
  
  /** Add metrics endpoint */
  metrics(path: string): ZapBuilder;
  
  /** Start listening */
  listen(): Promise<void>;
}

// Re-export the main class as default
export default Zap; 