/**
 * @fileoverview Zap - Ultra-fast HTTP Framework for Node.js and Bun
 * @module zap-rs
 *
 * High-performance HTTP server powered by Rust with TypeScript bindings.
 * Uses IPC-based architecture for blazing-fast request handling.
 *
 * @example
 * ```typescript
 * import { Zap } from 'zap-rs';
 *
 * const app = new Zap({ port: 3000 });
 *
 * app.get('/', () => ({ message: 'Hello, World!' }));
 * app.get('/users/:id', (req) => ({
 *   id: req.params.id,
 *   query: req.query
 * }));
 *
 * await app.listen();
 * ```
 */

import { join } from "path";
import { tmpdir } from "os";
import { ProcessManager } from "./process-manager";
import { IpcServer, IpcRequest } from "./ipc-client";
import {
  ZapOptions,
  ZapConfig,
  RouteConfig,
  Handler,
  ZapRequest,
  ZapResponse,
  HttpMethod,
  LogLevel,
  ZapError,
  ZapErrorCode,
  Headers,
} from "./types";

// Re-export types for consumers
export * from "./types";
export { IpcServer, IpcRequest } from "./ipc-client";
export { ProcessManager } from "./process-manager";

/**
 * Create an enhanced request object with helper methods
 */
function createZapRequest(ipcRequest: IpcRequest): ZapRequest {
  return {
    ...ipcRequest,

    param(name: string): string | undefined {
      return ipcRequest.params[name];
    },

    queryParam(name: string): string | undefined {
      return ipcRequest.query[name];
    },

    header(name: string): string | undefined {
      // Case-insensitive header lookup
      const lowerName = name.toLowerCase();
      for (const [key, value] of Object.entries(ipcRequest.headers)) {
        if (key.toLowerCase() === lowerName) {
          return value;
        }
      }
      return undefined;
    },

    cookie(name: string): string | undefined {
      return ipcRequest.cookies[name];
    },

    json<T = unknown>(): T {
      try {
        return JSON.parse(ipcRequest.body) as T;
      } catch (error) {
        throw new ZapError(
          ZapErrorCode.HANDLER_EXECUTION_ERROR,
          `Failed to parse JSON body: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },

    buffer(): Buffer {
      return Buffer.from(ipcRequest.body, "utf-8");
    },
  };
}

/**
 * Zap - Ultra-fast HTTP server for Node.js and Bun
 *
 * This is the main API entry point. It manages:
 * 1. Route registration from TypeScript
 * 2. Spawning and managing the Rust binary process
 * 3. IPC communication between TypeScript handlers and Rust server
 *
 * @example
 * ```typescript
 * const app = new Zap({ port: 3000 });
 *
 * // Simple JSON response
 * app.get('/', () => ({ message: 'Hello!' }));
 *
 * // With request data
 * app.post('/api/users', (req) => {
 *   const body = req.json();
 *   return { created: true, data: body };
 * });
 *
 * // With route parameters
 * app.get('/users/:id', (req) => ({
 *   userId: req.param('id'),
 *   includeDetails: req.queryParam('details') === 'true'
 * }));
 *
 * await app.listen();
 * ```
 */
export class Zap {
  private processManager!: ProcessManager;
  private ipcServer!: IpcServer;
  private readonly handlers: Map<string, Handler> = new Map();
  private readonly routes: RouteConfig[] = [];
  private readonly staticFiles: Array<{ prefix: string; directory: string }> = [];

  // Server configuration
  private port: number;
  private hostname: string;
  private logLevel: LogLevel;
  private maxRequestBodySize: number;
  private requestTimeoutSecs: number;
  private keepaliveTimeoutSecs: number;

  // Endpoint paths
  private healthCheckPath: string;
  private metricsPath: string | null;

  // Middleware flags
  private enableCors: boolean;
  private enableLogging: boolean;
  private enableCompression: boolean;

  // State
  private isInitialized = false;
  private readonly socketPath: string;

  /**
   * Create a new Zap server instance
   * @param options - Server configuration options
   */
  constructor(options: ZapOptions = {}) {
    // Apply configuration with defaults
    this.port = options.port ?? 3000;
    this.hostname = options.hostname ?? "127.0.0.1";
    this.logLevel = options.logLevel ?? "info";
    this.maxRequestBodySize = options.maxRequestBodySize ?? 10 * 1024 * 1024; // 10MB
    this.requestTimeoutSecs = options.requestTimeoutSecs ?? 30;
    this.keepaliveTimeoutSecs = options.keepaliveTimeoutSecs ?? 5;

    // Defaults
    this.healthCheckPath = "/health";
    this.metricsPath = null;
    this.enableCors = false;
    this.enableLogging = false;
    this.enableCompression = false;

    // Generate unique socket path
    this.socketPath = join(
      tmpdir(),
      `zap-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.sock`
    );
  }

  /**
   * Initialize managers lazily to avoid errors during construction
   */
  private initialize(): void {
    if (this.isInitialized) return;

    this.processManager = new ProcessManager(undefined, this.socketPath);
    this.ipcServer = new IpcServer(this.socketPath);
    this.isInitialized = true;
  }

  // ============================================================================
  // Fluent Configuration API
  // ============================================================================

  /**
   * Set the server port
   * @param port - Port number (1-65535)
   */
  setPort(port: number): this {
    if (port < 1 || port > 65535) {
      throw new ZapError(
        ZapErrorCode.CONFIG_ERROR,
        `Invalid port: ${port}. Must be between 1 and 65535.`
      );
    }
    this.port = port;
    return this;
  }

  /**
   * Set the server hostname
   * @param hostname - Hostname or IP address to bind to
   */
  setHostname(hostname: string): this {
    if (!hostname) {
      throw new ZapError(ZapErrorCode.CONFIG_ERROR, "Hostname cannot be empty");
    }
    this.hostname = hostname;
    return this;
  }

  /**
   * Set the log level
   * @param level - Log level (trace, debug, info, warn, error)
   */
  setLogLevel(level: LogLevel): this {
    this.logLevel = level;
    return this;
  }

  /**
   * Set maximum request body size
   * @param bytes - Maximum body size in bytes
   */
  setMaxRequestBodySize(bytes: number): this {
    if (bytes < 0) {
      throw new ZapError(
        ZapErrorCode.CONFIG_ERROR,
        "Max request body size cannot be negative"
      );
    }
    this.maxRequestBodySize = bytes;
    return this;
  }

  /**
   * Enable CORS middleware with permissive defaults
   */
  cors(): this {
    this.enableCors = true;
    return this;
  }

  /**
   * Enable request logging middleware
   */
  logging(): this {
    this.enableLogging = true;
    return this;
  }

  /**
   * Enable response compression middleware
   */
  compression(): this {
    this.enableCompression = true;
    return this;
  }

  /**
   * Set custom health check path
   * @param path - Path for health check endpoint
   */
  healthCheck(path: string): this {
    if (!path.startsWith("/")) {
      throw new ZapError(
        ZapErrorCode.CONFIG_ERROR,
        "Health check path must start with /"
      );
    }
    this.healthCheckPath = path;
    return this;
  }

  /**
   * Enable metrics endpoint
   * @param path - Path for metrics endpoint
   */
  metrics(path: string): this {
    if (!path.startsWith("/")) {
      throw new ZapError(
        ZapErrorCode.CONFIG_ERROR,
        "Metrics path must start with /"
      );
    }
    this.metricsPath = path;
    return this;
  }

  // ============================================================================
  // Route Registration API
  // ============================================================================

  /**
   * Register a GET route
   * @param path - Route path pattern (e.g., "/users/:id")
   * @param handler - Handler function
   */
  get(path: string, handler: Handler): this {
    return this.registerRoute("GET", path, handler);
  }

  /**
   * Register a POST route
   * @param path - Route path pattern
   * @param handler - Handler function
   */
  post(path: string, handler: Handler): this {
    return this.registerRoute("POST", path, handler);
  }

  /**
   * Register a PUT route
   * @param path - Route path pattern
   * @param handler - Handler function
   */
  put(path: string, handler: Handler): this {
    return this.registerRoute("PUT", path, handler);
  }

  /**
   * Register a DELETE route
   * @param path - Route path pattern
   * @param handler - Handler function
   */
  delete(path: string, handler: Handler): this {
    return this.registerRoute("DELETE", path, handler);
  }

  /**
   * Register a PATCH route
   * @param path - Route path pattern
   * @param handler - Handler function
   */
  patch(path: string, handler: Handler): this {
    return this.registerRoute("PATCH", path, handler);
  }

  /**
   * Register a HEAD route
   * @param path - Route path pattern
   * @param handler - Handler function
   */
  head(path: string, handler: Handler): this {
    return this.registerRoute("HEAD", path, handler);
  }

  /**
   * Register an OPTIONS route
   * @param path - Route path pattern
   * @param handler - Handler function
   */
  options(path: string, handler: Handler): this {
    return this.registerRoute("OPTIONS", path, handler);
  }

  /**
   * Convenience method for GET routes that return JSON
   * @deprecated Use .get() instead - all object returns are automatically JSON
   */
  getJson(path: string, handler: Handler): this {
    return this.get(path, handler);
  }

  /**
   * Convenience method for POST routes that return JSON
   * @deprecated Use .post() instead - all object returns are automatically JSON
   */
  postJson(path: string, handler: Handler): this {
    return this.post(path, handler);
  }

  /**
   * Register static file serving
   * @param prefix - URL prefix for static files
   * @param directory - Local directory path
   */
  static(prefix: string, directory: string): this {
    if (!prefix.startsWith("/")) {
      throw new ZapError(
        ZapErrorCode.CONFIG_ERROR,
        "Static file prefix must start with /"
      );
    }
    this.staticFiles.push({ prefix, directory });
    return this;
  }

  /**
   * Register a route with a handler (internal)
   */
  private registerRoute(method: HttpMethod, path: string, handler: Handler): this {
    if (!path.startsWith("/")) {
      throw new ZapError(
        ZapErrorCode.CONFIG_ERROR,
        `Route path must start with /: ${path}`
      );
    }

    if (typeof handler !== "function") {
      throw new ZapError(
        ZapErrorCode.CONFIG_ERROR,
        `Handler for ${method} ${path} must be a function`
      );
    }

    const handlerId = `handler_${this.handlers.size}`;
    this.handlers.set(handlerId, handler);

    this.routes.push({
      method,
      path,
      handler_id: handlerId,
      is_typescript: true,
    });

    return this;
  }

  // ============================================================================
  // Server Lifecycle
  // ============================================================================

  /**
   * Start the server
   * @param port - Optional port override
   */
  async listen(port?: number): Promise<void> {
    // Initialize managers
    this.initialize();

    // Allow overriding port in listen()
    if (port !== undefined) {
      this.port = port;
    }

    try {
      // Start IPC server first
      console.log("[Zap] Starting IPC server...");
      await this.ipcServer.start();

      // Register all handlers with IPC server
      console.log(`[Zap] Registering ${this.handlers.size} handlers...`);
      this.registerHandlersWithIpc();

      // Build Rust configuration
      const config = this.buildConfig();

      // Start Rust server process
      console.log("[Zap] Starting Rust server process...");
      await this.processManager.start(config, this.logLevel);

      console.log(`[Zap] Server listening on http://${this.hostname}:${this.port}`);
    } catch (error) {
      console.error("[Zap] Failed to start server:", error);
      await this.close();
      throw error;
    }
  }

  /**
   * Register handlers with the IPC server
   */
  private registerHandlersWithIpc(): void {
    for (const [handlerId, handler] of this.handlers) {
      this.ipcServer.registerHandler(handlerId, async (ipcRequest: IpcRequest) => {
        // Create enhanced request object
        const zapRequest = createZapRequest(ipcRequest);

        // Execute handler
        const result = await handler(zapRequest);

        // Convert result to response format
        return this.normalizeResponse(result);
      });
    }
  }

  /**
   * Normalize handler result to response format
   */
  private normalizeResponse(
    result: string | object | Response | ZapResponse
  ): { status: number; headers: Headers; body: string } {
    // Handle Response object (Web API)
    if (result instanceof Response) {
      // This is async but we need sync here - use a placeholder
      // In practice, you'd want to await this, but for now return a simple response
      return {
        status: result.status,
        headers: Object.fromEntries(result.headers.entries()),
        body: "", // Would need async handling
      };
    }

    // Handle string
    if (typeof result === "string") {
      return {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
        body: result,
      };
    }

    // Handle ZapResponse
    if (this.isZapResponse(result)) {
      const headers: Headers = result.headers ?? {
        "content-type": "application/json",
      };
      let body: string;

      if (typeof result.body === "string") {
        body = result.body;
      } else if (Buffer.isBuffer(result.body)) {
        body = result.body.toString("utf-8");
      } else if (result.body !== undefined) {
        body = JSON.stringify(result.body);
        if (!headers["content-type"]) {
          headers["content-type"] = "application/json";
        }
      } else {
        body = "";
      }

      return {
        status: result.status ?? 200,
        headers,
        body,
      };
    }

    // Default: JSON response
    return {
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(result),
    };
  }

  /**
   * Type guard for ZapResponse
   */
  private isZapResponse(value: unknown): value is ZapResponse {
    return (
      typeof value === "object" &&
      value !== null &&
      ("status" in value || "headers" in value || "body" in value)
    );
  }

  /**
   * Build configuration for Rust server
   */
  private buildConfig(): ZapConfig {
    return {
      port: this.port,
      hostname: this.hostname,
      ipc_socket_path: this.processManager.getSocketPath(),
      max_request_body_size: this.maxRequestBodySize,
      request_timeout_secs: this.requestTimeoutSecs,
      keepalive_timeout_secs: this.keepaliveTimeoutSecs,
      routes: this.routes,
      static_files: this.staticFiles,
      middleware: {
        enable_cors: this.enableCors,
        enable_logging: this.enableLogging,
        enable_compression: this.enableCompression,
      },
      health_check_path: this.healthCheckPath,
      metrics_path: this.metricsPath ?? undefined,
    };
  }

  /**
   * Close the server gracefully
   */
  async close(): Promise<void> {
    console.log("[Zap] Closing server...");

    try {
      if (this.processManager) {
        await this.processManager.stop();
      }
      if (this.ipcServer) {
        await this.ipcServer.stop();
      }
      console.log("[Zap] Server closed");
    } catch (error) {
      console.error("[Zap] Error closing server:", error);
      throw error;
    }
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.isInitialized && this.processManager?.isRunning();
  }

  /**
   * Get the server address
   */
  getAddress(): { hostname: string; port: number } {
    return { hostname: this.hostname, port: this.port };
  }

  /**
   * Get the number of registered routes
   */
  getRouteCount(): number {
    return this.routes.length;
  }
}

// Default export
export default Zap;
