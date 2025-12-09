import { spawn, ChildProcess, execSync } from "child_process";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

export interface ZapConfig {
  port: number;
  hostname: string;
  ipc_socket_path: string;
  max_request_body_size?: number;
  request_timeout_secs?: number;
  routes: RouteConfig[];
  static_files: StaticFileConfig[];
  middleware: MiddlewareConfig;
  health_check_path?: string;
  metrics_path?: string;
}

export interface RouteConfig {
  method: string;
  path: string;
  handler_id: string;
  is_typescript: boolean;
}

export interface StaticFileConfig {
  prefix: string;
  directory: string;
  options?: Record<string, any>;
}

export interface MiddlewareConfig {
  enable_cors?: boolean;
  enable_logging?: boolean;
  enable_compression?: boolean;
}

/**
 * ProcessManager
 *
 * Manages the lifecycle of the Rust binary process:
 * - Spawning the process with proper configuration
 * - Forwarding logs to console
 * - Monitoring for crashes
 * - Graceful shutdown with timeout
 * - Health check polling
 */
export class ProcessManager {
  private process: ChildProcess | null = null;
  private configPath: string | null = null;
  private binaryPath: string;
  private socketPath: string;

  constructor(binaryPath?: string, socketPath?: string) {
    this.binaryPath = binaryPath || this.getDefaultBinaryPath();
    this.socketPath = socketPath || join(tmpdir(), `zap-${Date.now()}.sock`);
  }

  /**
   * Find the Zap binary in common locations
   */
  private getDefaultBinaryPath(): string {
    // Try multiple locations
    const arch = process.arch === "arm64" ? "aarch64-apple-darwin" : `${process.arch}-${process.platform}`;
    const candidates = [
      join(__dirname, `../target/${arch}/release/zap`),
      join(__dirname, "../target/release/zap"),
      join(__dirname, "../server/target/release/zap"),
      join(process.cwd(), "target/release/zap"),
      join(process.cwd(), `target/${arch}/release/zap`),
      "zap", // System PATH
    ];

    for (const candidate of candidates) {
      if (this.binaryExists(candidate)) {
        return candidate;
      }
    }

    throw new Error(
      "Zap binary not found. Build with: npm run build:rust or cargo build --release --bin zap"
    );
  }

  /**
   * Check if a binary file exists and is executable
   */
  private binaryExists(path: string): boolean {
    if (!existsSync(path)) {
      return false;
    }

    // For system PATH, just check existence
    if (!path.includes("/")) {
      return true;
    }

    // For local paths, more thorough check
    try {
      execSync(`test -x "${path}"`, { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Start the Rust server process
   */
  async start(config: ZapConfig, logLevel: string = "info"): Promise<void> {
    try {
      // Write configuration to temporary JSON file
      this.configPath = join(tmpdir(), `zap-config-${Date.now()}.json`);
      writeFileSync(this.configPath, JSON.stringify(config, null, 2));

      console.log(`[Zap] 🚀 Starting server on ${config.hostname}:${config.port}`);
      console.log(`[Zap] 🔌 IPC socket: ${this.socketPath}`);

      // Spawn the Rust binary
      this.process = spawn(this.binaryPath, [
        "--config",
        this.configPath,
        "--socket",
        this.socketPath,
        "--log-level",
        logLevel,
      ], {
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          RUST_LOG: logLevel,
        },
      });

      if (!this.process.stdout || !this.process.stderr) {
        throw new Error("Failed to create process streams");
      }

      // Forward stdout
      this.process.stdout.on("data", (data) => {
        const output = data.toString().trim();
        if (output) {
          console.log(`[Zap] ${output}`);
        }
      });

      // Forward stderr
      this.process.stderr.on("data", (data) => {
        const output = data.toString().trim();
        if (output) {
          console.error(`[Zap] ❌ ${output}`);
        }
      });

      // Handle process exit
      this.process.on("exit", (code, signal) => {
        if (code !== 0 || signal) {
          console.error(
            `[Zap] ⚠️  Process exited: code=${code}, signal=${signal}`
          );
        }
      });

      // Handle process errors
      this.process.on("error", (err) => {
        console.error(`[Zap] ❌ Process error:`, err);
      });

      // Wait for the server to be healthy
      await this.waitForHealthy(
        config.hostname,
        config.port,
        config.health_check_path || "/health"
      );

      console.log(`[Zap] ✅ Server ready on http://${config.hostname}:${config.port}`);
    } catch (error) {
      // Clean up on error
      await this.stop();
      throw error;
    }
  }

  /**
   * Poll the health check endpoint until the server is ready
   */
  private async waitForHealthy(
    hostname: string,
    port: number,
    healthPath: string,
    maxAttempts: number = 50,
    delayMs: number = 100
  ): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1000);

        const response = await fetch(`http://${hostname}:${port}${healthPath}`, {
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.ok) {
          return;
        }
      } catch (e) {
        // Server not ready yet, continue polling
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    throw new Error(
      `Server failed to start within ${maxAttempts * delayMs}ms`
    );
  }

  /**
   * Stop the server process gracefully
   */
  async stop(): Promise<void> {
    if (!this.process) {
      // Clean up config file if it exists
      if (this.configPath && existsSync(this.configPath)) {
        try {
          unlinkSync(this.configPath);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      return;
    }

    return new Promise((resolve) => {
      if (!this.process) {
        resolve();
        return;
      }

      // Set up timeout for forceful termination
      const forceTimeout = setTimeout(() => {
        console.log("[Zap] ⚠️  Force killing process (SIGKILL)");
        if (this.process && !this.process.killed) {
          this.process.kill("SIGKILL");
        }
      }, 5000);

      this.process.once("exit", () => {
        clearTimeout(forceTimeout);
        this.process = null;

        // Clean up config file
        if (this.configPath && existsSync(this.configPath)) {
          try {
            unlinkSync(this.configPath);
          } catch (e) {
            // Ignore cleanup errors
          }
        }

        resolve();
      });

      // Initiate graceful shutdown
      console.log("[Zap] 📛 Shutting down gracefully...");
      this.process.kill("SIGTERM");
    });
  }

  /**
   * Restart the server
   */
  async restart(config: ZapConfig, logLevel: string = "info"): Promise<void> {
    console.log("[Zap] 🔄 Restarting server...");
    await this.stop();
    // Small delay to ensure clean shutdown
    await new Promise((resolve) => setTimeout(resolve, 100));
    await this.start(config, logLevel);
  }

  /**
   * Get the IPC socket path
   */
  getSocketPath(): string {
    return this.socketPath;
  }

  /**
   * Check if the process is still running
   */
  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }
}
