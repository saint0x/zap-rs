/**
 * @fileoverview IPC Server for TypeScript handler communication
 * @module zap-rs/ipc-client
 *
 * Listens on a Unix socket for IPC messages from the Rust backend.
 * The Rust server sends handler invocation requests, which we dispatch
 * to the registered TypeScript handlers and send responses back.
 *
 * Protocol: Newline-delimited JSON over Unix domain socket
 */

import { createServer, Server, Socket } from "net";
import { createInterface } from "readline";
import { unlinkSync, existsSync } from "fs";
import {
  IpcRequest,
  IpcMessage,
  HandlerFunction,
  ZapError,
  ZapErrorCode,
  Headers,
} from "./types";

// Re-export types for backwards compatibility
export type { IpcRequest, IpcMessage, HandlerFunction };

/**
 * IPC Server
 *
 * Manages Unix domain socket communication with the Rust server.
 * Handles incoming handler invocations and sends responses back.
 */
export class IpcServer {
  private server: Server | null = null;
  private readonly socketPath: string;
  private readonly handlers: Map<string, HandlerFunction> = new Map();
  private connections: Set<Socket> = new Set();
  private isShuttingDown = false;

  /**
   * Create a new IPC server
   * @param socketPath - Path to the Unix domain socket
   */
  constructor(socketPath: string) {
    if (!socketPath) {
      throw new ZapError(
        ZapErrorCode.CONFIG_ERROR,
        "Socket path is required for IPC server"
      );
    }
    this.socketPath = socketPath;
  }

  /**
   * Register a handler function for a specific handler ID
   * @param handlerId - Unique identifier for the handler
   * @param handler - The handler function to register
   */
  registerHandler(handlerId: string, handler: HandlerFunction): void {
    if (!handlerId) {
      throw new ZapError(
        ZapErrorCode.CONFIG_ERROR,
        "Handler ID is required"
      );
    }
    if (typeof handler !== "function") {
      throw new ZapError(
        ZapErrorCode.CONFIG_ERROR,
        `Handler for '${handlerId}' must be a function`
      );
    }
    this.handlers.set(handlerId, handler);
  }

  /**
   * Unregister a handler
   * @param handlerId - ID of the handler to remove
   * @returns true if handler was found and removed
   */
  unregisterHandler(handlerId: string): boolean {
    return this.handlers.delete(handlerId);
  }

  /**
   * Get the number of registered handlers
   */
  get handlerCount(): number {
    return this.handlers.size;
  }

  /**
   * Get the socket path
   */
  getSocketPath(): string {
    return this.socketPath;
  }

  /**
   * Start the IPC server listening on the Unix socket
   * @returns Promise that resolves when server is listening
   */
  async start(): Promise<void> {
    if (this.server) {
      throw new ZapError(
        ZapErrorCode.CONFIG_ERROR,
        "IPC server is already running"
      );
    }

    return new Promise((resolve, reject) => {
      try {
        // Clean up old socket file if it exists
        this.cleanupSocket();

        // Create Unix domain socket server
        this.server = createServer((socket) => {
          this.handleConnection(socket);
        });

        this.server.on("error", (err: Error) => {
          console.error(`[IPC] Server error:`, err);
          if (!this.isShuttingDown) {
            reject(
              new ZapError(
                ZapErrorCode.IPC_CONNECTION_ERROR,
                `IPC server error: ${err.message}`,
                err
              )
            );
          }
        });

        this.server.listen(this.socketPath, () => {
          console.log(`[IPC] Server listening on ${this.socketPath}`);
          resolve();
        });
      } catch (error) {
        reject(
          new ZapError(
            ZapErrorCode.IPC_CONNECTION_ERROR,
            `Failed to start IPC server: ${error instanceof Error ? error.message : String(error)}`,
            error
          )
        );
      }
    });
  }

  /**
   * Handle a new IPC connection from the Rust server
   */
  private handleConnection(socket: Socket): void {
    if (this.isShuttingDown) {
      socket.destroy();
      return;
    }

    this.connections.add(socket);
    console.log(`[IPC] Client connected (${this.connections.size} active)`);

    const readline = createInterface({
      input: socket,
      crlfDelay: Infinity,
    });

    // Handle incoming messages (newline-delimited JSON)
    readline.on("line", async (line: string) => {
      if (!line.trim()) return;

      try {
        const message: IpcMessage = JSON.parse(line);
        const response = await this.processMessage(message);
        // Send response as newline-delimited JSON
        if (!socket.destroyed) {
          socket.write(JSON.stringify(response) + "\n");
        }
      } catch (error) {
        console.error(`[IPC] Error processing message:`, error);
        const errorResponse = this.createErrorResponse(
          ZapErrorCode.HANDLER_EXECUTION_ERROR,
          error instanceof Error ? error.message : String(error)
        );
        if (!socket.destroyed) {
          socket.write(JSON.stringify(errorResponse) + "\n");
        }
      }
    });

    readline.on("close", () => {
      this.connections.delete(socket);
      console.log(`[IPC] Client disconnected (${this.connections.size} active)`);
    });

    readline.on("error", (error) => {
      console.error(`[IPC] Connection error:`, error);
      this.connections.delete(socket);
    });

    socket.on("error", (error) => {
      // Ignore ECONNRESET errors during shutdown
      if (this.isShuttingDown && (error as NodeJS.ErrnoException).code === "ECONNRESET") {
        return;
      }
      console.error(`[IPC] Socket error:`, error);
      this.connections.delete(socket);
    });
  }

  /**
   * Process an incoming IPC message
   */
  private async processMessage(message: IpcMessage): Promise<IpcMessage> {
    switch (message.type) {
      case "invoke_handler":
        return this.handleInvokeHandler(message);

      case "health_check":
        return { type: "health_check_response" };

      default:
        return this.createErrorResponse(
          ZapErrorCode.IPC_PROTOCOL_ERROR,
          `Unknown message type: ${message.type}`
        );
    }
  }

  /**
   * Handle a handler invocation request
   */
  private async handleInvokeHandler(message: IpcMessage): Promise<IpcMessage> {
    const { handler_id, request } = message as unknown as {
      handler_id: string;
      request: IpcRequest;
    };

    const handler = this.handlers.get(handler_id);
    if (!handler) {
      return this.createErrorResponse(
        ZapErrorCode.HANDLER_NOT_FOUND,
        `Handler '${handler_id}' not found`
      );
    }

    try {
      console.log(
        `[IPC] Invoking handler: ${handler_id} for ${request.method} ${request.path}`
      );

      const startTime = performance.now();
      const result = await handler(request);
      const duration = (performance.now() - startTime).toFixed(2);

      console.log(`[IPC] Handler ${handler_id} completed in ${duration}ms`);

      return {
        type: "handler_response",
        handler_id,
        status: result.status ?? 200,
        headers: result.headers ?? { "content-type": "application/json" },
        body: result.body ?? "{}",
      };
    } catch (error) {
      console.error(`[IPC] Handler '${handler_id}' error:`, error);
      return this.createErrorResponse(
        ZapErrorCode.HANDLER_EXECUTION_ERROR,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Create an error response message
   */
  private createErrorResponse(code: ZapErrorCode, message: string): IpcMessage {
    return {
      type: "error",
      code,
      message,
    };
  }

  /**
   * Clean up socket file
   */
  private cleanupSocket(): void {
    if (existsSync(this.socketPath)) {
      try {
        unlinkSync(this.socketPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Stop the IPC server gracefully
   * @param timeout - Maximum time to wait for connections to close (ms)
   */
  async stop(timeout = 5000): Promise<void> {
    if (!this.server) {
      return;
    }

    this.isShuttingDown = true;
    console.log(`[IPC] Shutting down server...`);

    // Close all active connections
    for (const socket of this.connections) {
      socket.destroy();
    }
    this.connections.clear();

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        console.log(`[IPC] Force closing server after timeout`);
        this.server?.close();
        this.cleanupSocket();
        this.server = null;
        this.isShuttingDown = false;
        resolve();
      }, timeout);

      this.server!.close(() => {
        clearTimeout(timer);
        this.cleanupSocket();
        this.server = null;
        this.isShuttingDown = false;
        console.log(`[IPC] Server stopped`);
        resolve();
      });
    });
  }

  /**
   * Check if the server is running
   */
  isRunning(): boolean {
    return this.server !== null && !this.isShuttingDown;
  }
}
