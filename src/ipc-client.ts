import { createServer, Server, Socket } from "net";
import { createInterface, Interface } from "readline";
import { unlinkSync, existsSync } from "fs";

export interface IpcRequest {
  method: string;
  path: string;
  path_only: string;
  query: Record<string, string>;
  params: Record<string, string>;
  headers: Record<string, string>;
  body: string;
  cookies: Record<string, string>;
}

export interface IpcMessage {
  type: string;
  [key: string]: any;
}

export type HandlerFunction = (
  req: IpcRequest
) => Promise<{ status: number; headers: Record<string, string>; body: string }>;

/**
 * IpcServer
 *
 * Listens on a Unix socket for IPC messages from the Rust backend.
 * The Rust server sends handler invocation requests, which we dispatch
 * to the registered TypeScript handlers and send responses back.
 *
 * Protocol: Newline-delimited JSON over Unix domain socket
 */
export class IpcServer {
  private server: Server | null = null;
  private socketPath: string;
  private handlers: Map<string, HandlerFunction> = new Map();

  constructor(socketPath: string) {
    this.socketPath = socketPath;
  }

  /**
   * Register a handler function for a specific handler ID
   */
  registerHandler(handlerId: string, handler: HandlerFunction): void {
    this.handlers.set(handlerId, handler);
  }

  /**
   * Start the IPC server listening on the Unix socket
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Clean up old socket file if it exists
        if (existsSync(this.socketPath)) {
          try {
            unlinkSync(this.socketPath);
          } catch (e) {
            // Ignore if we can't delete it
          }
        }

        // Create Unix domain socket server
        this.server = createServer((socket) => {
          this.handleConnection(socket);
        });

        this.server.on("error", (err) => {
          console.error(`[IPC] Server error:`, err);
          reject(err);
        });

        this.server.listen(this.socketPath, () => {
          console.log(`[IPC] ✅ IPC server listening on ${this.socketPath}`);
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle a new IPC connection from the Rust server
   */
  private handleConnection(socket: Socket): void {
    console.log(`[IPC] 📡 Client connected`);

    const readline = createInterface({
      input: socket,
      crlfDelay: Infinity,
    });

    // Handle incoming messages (newline-delimited JSON)
    readline.on("line", async (line: string) => {
      try {
        const message: IpcMessage = JSON.parse(line);
        const response = await this.processMessage(message);
        // Send response as newline-delimited JSON
        socket.write(JSON.stringify(response) + "\n");
      } catch (error) {
        console.error(`[IPC] ❌ Error processing message:`, error);
        const errorResponse = {
          type: "error",
          code: "HANDLER_ERROR",
          message: String(error),
        };
        socket.write(JSON.stringify(errorResponse) + "\n");
      }
    });

    readline.on("close", () => {
      console.log(`[IPC] 📭 Client disconnected`);
    });

    readline.on("error", (error) => {
      console.error(`[IPC] ❌ Connection error:`, error);
    });
  }

  /**
   * Process an incoming IPC message
   */
  private async processMessage(message: IpcMessage): Promise<IpcMessage> {
    if (message.type === "invoke_handler") {
      const { handler_id, request } = message;
      const handler = this.handlers.get(handler_id);

      if (!handler) {
        return {
          type: "error",
          code: "HANDLER_NOT_FOUND",
          message: `Handler ${handler_id} not found`,
        };
      }

      try {
        console.log(`[IPC] 📤 Invoking handler: ${handler_id} for ${request.method} ${request.path}`);
        const result = await handler(request);

        return {
          type: "handler_response",
          handler_id,
          status: result.status || 200,
          headers: result.headers || { "content-type": "application/json" },
          body: result.body || "{}",
        };
      } catch (error) {
        console.error(
          `[IPC] ❌ Error executing handler ${handler_id}:`,
          error
        );
        return {
          type: "error",
          code: "HANDLER_EXECUTION_ERROR",
          message: String(error),
        };
      }
    }

    // Health check message
    if (message.type === "health_check") {
      return { type: "health_check_response" };
    }

    return {
      type: "error",
      code: "UNKNOWN_MESSAGE_TYPE",
      message: `Unknown message type: ${message.type}`,
    };
  }

  /**
   * Stop the IPC server
   */
  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          // Clean up socket file
          if (existsSync(this.socketPath)) {
            try {
              unlinkSync(this.socketPath);
            } catch (e) {
              // Ignore
            }
          }
          resolve();
        });
      });
    }
  }
}
