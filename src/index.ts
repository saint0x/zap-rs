import { join } from "path";
import { tmpdir } from "os";
import { ProcessManager, ZapConfig, RouteConfig, MiddlewareConfig } from "./process-manager";
import { IpcServer, IpcRequest, HandlerFunction } from "./ipc-client";

export interface ZapOptions {
  port?: number;
  hostname?: string;
  logLevel?: "trace" | "debug" | "info" | "warn" | "error";
}

export type Handler = (request: any) => any | Promise<any>;

/**
 * Zap - Ultra-fast HTTP server for Node.js and Bun
 *
 * This is the main API entry point. It manages:
 * 1. Route registration from TypeScript
 * 2. Spawning and managing the Rust binary process
 * 3. IPC communication between TypeScript handlers and Rust server
 *
 * Usage:
 * ```
 * const app = new Zap({ port: 3000 });
 * app.get('/', () => ({ message: 'Hello!' }));
 * app.post('/api/data', (req) => ({ received: req.body }));
 * await app.listen();
 * ```
 */
export class Zap {
  private processManager: ProcessManager;
  private ipcServer: IpcServer;
  private handlers: Map<string, Handler> = new Map();
  private routes: RouteConfig[] = [];
  private staticFiles: Array<{ prefix: string; directory: string }> = [];

  private port: number = 3000;
  private hostname: string = "127.0.0.1";
  private logLevel: "trace" | "debug" | "info" | "warn" | "error" = "info";
  private healthCheckPath: string = "/health";
  private metricsPath: string | null = null;

  private enableCors: boolean = false;
  private enableLogging: boolean = false;
  private enableCompression: boolean = false;

  constructor(options?: ZapOptions) {
    // Parse options
    if (options?.port) this.port = options.port;
    if (options?.hostname) this.hostname = options.hostname;
    if (options?.logLevel) this.logLevel = options.logLevel;

    // Create IPC socket path (unique per instance)
    const socketPath = join(tmpdir(), `zap-${Date.now()}-${Math.random().toString(36).substring(7)}.sock`);

    // Initialize managers
    this.processManager = new ProcessManager(undefined, socketPath);
    this.ipcServer = new IpcServer(socketPath);
  }

  // ============================================================================
  // Fluent Configuration API
  // ============================================================================

  /**
   * Set the server port
   */
  setPort(port: number): this {
    this.port = port;
    return this;
  }

  /**
   * Set the server hostname
   */
  setHostname(hostname: string): this {
    this.hostname = hostname;
    return this;
  }

  /**
   * Enable CORS middleware
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
   */
  healthCheck(path: string): this {
    this.healthCheckPath = path;
    return this;
  }

  /**
   * Set metrics endpoint path
   */
  metrics(path: string): this {
    this.metricsPath = path;
    return this;
  }

  // ============================================================================
  // Route Registration API
  // ============================================================================

  /**
   * Register a GET route
   */
  get(path: string, handler: Handler): this {
    return this.registerRoute("GET", path, handler);
  }

  /**
   * Register a POST route
   */
  post(path: string, handler: Handler): this {
    return this.registerRoute("POST", path, handler);
  }

  /**
   * Register a PUT route
   */
  put(path: string, handler: Handler): this {
    return this.registerRoute("PUT", path, handler);
  }

  /**
   * Register a DELETE route
   */
  delete(path: string, handler: Handler): this {
    return this.registerRoute("DELETE", path, handler);
  }

  /**
   * Register a PATCH route
   */
  patch(path: string, handler: Handler): this {
    return this.registerRoute("PATCH", path, handler);
  }

  /**
   * Register a HEAD route
   */
  head(path: string, handler: Handler): this {
    return this.registerRoute("HEAD", path, handler);
  }

  /**
   * Convenience method for GET routes that return JSON
   */
  getJson(path: string, handler: Handler): this {
    return this.get(path, handler);
  }

  /**
   * Convenience method for POST routes that return JSON
   */
  postJson(path: string, handler: Handler): this {
    return this.post(path, handler);
  }

  /**
   * Register static file serving
   */
  static(prefix: string, directory: string): this {
    this.staticFiles.push({ prefix, directory });
    return this;
  }

  /**
   * Register a route with a handler (internal)
   */
  private registerRoute(
    method: string,
    path: string,
    handler: Handler
  ): this {
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
   */
  async listen(port?: number): Promise<void> {
    // Allow overriding port in listen()
    if (port !== undefined) {
      this.port = port;
    }

    try {
      // Start IPC server first
      console.log("[Zap] 🚀 Starting IPC server...");
      await this.ipcServer.start();

      // Register all handlers with IPC server
      console.log(`[Zap] 📝 Registering ${this.handlers.size} handlers...`);
      for (const [handlerId, handler] of this.handlers) {
        this.ipcServer.registerHandler(handlerId, async (req: IpcRequest) => {
          const result = await handler(req);

          // Handle different response types
          if (result instanceof Response) {
            return {
              status: result.status,
              headers: Object.fromEntries(result.headers.entries()),
              body: await result.text(),
            };
          }

          if (typeof result === "string") {
            return {
              status: 200,
              headers: { "content-type": "text/plain" },
              body: result,
            };
          }

          // Default to JSON
          return {
            status: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(result),
          };
        });
      }

      // Build Rust configuration
      const config: ZapConfig = {
        port: this.port,
        hostname: this.hostname,
        ipc_socket_path: this.processManager.getSocketPath(),
        routes: this.routes,
        static_files: this.staticFiles,
        middleware: {
          enable_cors: this.enableCors,
          enable_logging: this.enableLogging,
          enable_compression: this.enableCompression,
        },
        health_check_path: this.healthCheckPath,
        metrics_path: this.metricsPath || undefined,
      };

      // Start Rust server process
      console.log("[Zap] 🦀 Starting Rust server process...");
      await this.processManager.start(config, this.logLevel);

      console.log(`[Zap] ✅ Server listening on http://${this.hostname}:${this.port}`);
    } catch (error) {
      console.error("[Zap] ❌ Failed to start server:", error);
      await this.close();
      throw error;
    }
  }

  /**
   * Close the server gracefully
   */
  async close(): Promise<void> {
    console.log("[Zap] 🛑 Closing server...");

    try {
      await this.processManager.stop();
      await this.ipcServer.stop();
      console.log("[Zap] ✅ Server closed");
    } catch (error) {
      console.error("[Zap] ❌ Error closing server:", error);
      throw error;
    }
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.processManager.isRunning();
  }
}

export default Zap;
