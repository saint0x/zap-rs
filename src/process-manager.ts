/**
 * @fileoverview Process Manager for Rust binary lifecycle
 * @module zap-rs/process-manager
 *
 * Manages the lifecycle of the Rust binary process:
 * - Spawning the process with proper configuration
 * - Forwarding logs to console
 * - Monitoring for crashes
 * - Graceful shutdown with timeout
 * - Health check polling
 */

import { spawn, ChildProcess, execSync } from "child_process";
import { writeFileSync, unlinkSync, existsSync, statSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  ZapConfig,
  RouteConfig,
  StaticFileConfig,
  MiddlewareConfig,
  LogLevel,
  ZapError,
  ZapErrorCode,
} from "./types";

// Re-export types for backwards compatibility
export type { ZapConfig, RouteConfig, StaticFileConfig, MiddlewareConfig };

/**
 * Binary location search result
 */
interface BinarySearchResult {
  found: boolean;
  path?: string;
  searchedPaths: string[];
}

/**
 * ProcessManager
 *
 * Manages the lifecycle of the Rust binary process.
 * Handles spawning, monitoring, and graceful shutdown.
 */
export class ProcessManager {
  private process: ChildProcess | null = null;
  private configPath: string | null = null;
  private readonly binaryPath: string;
  private readonly socketPath: string;
  private isShuttingDown = false;
  private restartCount = 0;
  private readonly maxRestarts = 3;

  /**
   * Create a new ProcessManager
   * @param binaryPath - Optional path to the Zap binary
   * @param socketPath - Optional path for the IPC socket
   */
  constructor(binaryPath?: string, socketPath?: string) {
    this.socketPath =
      socketPath ?? join(tmpdir(), `zap-${Date.now()}-${this.randomId()}.sock`);

    const searchResult = this.findBinary(binaryPath);
    if (!searchResult.found || !searchResult.path) {
      throw new ZapError(
        ZapErrorCode.BINARY_NOT_FOUND,
        `Zap binary not found. Build with: npm run build:rust or cargo build --release --bin zap\nSearched paths: ${searchResult.searchedPaths.join(", ")}`
      );
    }
    this.binaryPath = searchResult.path;
  }

  /**
   * Generate a random ID for unique socket names
   */
  private randomId(): string {
    return Math.random().toString(36).substring(2, 9);
  }

  /**
   * Find the Zap binary in common locations
   */
  private findBinary(explicitPath?: string): BinarySearchResult {
    const searchedPaths: string[] = [];

    // If explicit path provided, check it first
    if (explicitPath) {
      searchedPaths.push(explicitPath);
      if (this.binaryExists(explicitPath)) {
        return { found: true, path: explicitPath, searchedPaths };
      }
    }

    // Determine architecture-specific path
    const arch =
      process.arch === "arm64"
        ? "aarch64-apple-darwin"
        : `${process.arch}-${process.platform}`;

    // Common binary locations to check
    const candidates = [
      join(__dirname, `../target/${arch}/release/zap`),
      join(__dirname, "../target/release/zap"),
      join(__dirname, "../server/target/release/zap"),
      join(process.cwd(), "target/release/zap"),
      join(process.cwd(), `target/${arch}/release/zap`),
      // Debug builds
      join(__dirname, `../target/${arch}/debug/zap`),
      join(__dirname, "../target/debug/zap"),
      join(process.cwd(), "target/debug/zap"),
    ];

    for (const candidate of candidates) {
      searchedPaths.push(candidate);
      if (this.binaryExists(candidate)) {
        return { found: true, path: candidate, searchedPaths };
      }
    }

    // Check system PATH last
    try {
      const whichResult = execSync("which zap", { encoding: "utf-8" }).trim();
      if (whichResult) {
        searchedPaths.push("PATH: " + whichResult);
        return { found: true, path: whichResult, searchedPaths };
      }
    } catch {
      searchedPaths.push("PATH (not found)");
    }

    return { found: false, searchedPaths };
  }

  /**
   * Check if a binary file exists and is executable
   */
  private binaryExists(path: string): boolean {
    try {
      const stats = statSync(path);
      if (!stats.isFile()) return false;

      // On Unix, check execute permission
      if (process.platform !== "win32") {
        execSync(`test -x "${path}"`, { stdio: "ignore" });
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Start the Rust server process
   * @param config - Server configuration
   * @param logLevel - Log level for the server
   */
  async start(config: ZapConfig, logLevel: LogLevel = "info"): Promise<void> {
    if (this.process) {
      throw new ZapError(
        ZapErrorCode.CONFIG_ERROR,
        "Process is already running. Call stop() first."
      );
    }

    this.isShuttingDown = false;

    try {
      // Write configuration to temporary JSON file
      this.configPath = join(
        tmpdir(),
        `zap-config-${Date.now()}-${this.randomId()}.json`
      );
      writeFileSync(this.configPath, JSON.stringify(config, null, 2));

      console.log(`[Zap] Starting server on ${config.hostname}:${config.port}`);
      console.log(`[Zap] IPC socket: ${this.socketPath}`);
      console.log(`[Zap] Binary: ${this.binaryPath}`);

      // Spawn the Rust binary
      this.process = spawn(
        this.binaryPath,
        ["--config", this.configPath, "--socket", this.socketPath, "--log-level", logLevel],
        {
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            RUST_LOG: logLevel,
            RUST_BACKTRACE: "1",
          },
        }
      );

      if (!this.process.stdout || !this.process.stderr) {
        throw new ZapError(
          ZapErrorCode.IPC_CONNECTION_ERROR,
          "Failed to create process streams"
        );
      }

      // Set up stream handling
      this.setupProcessStreams();

      // Wait for the server to be healthy
      await this.waitForHealthy(
        config.hostname,
        config.port,
        config.health_check_path ?? "/health"
      );

      console.log(
        `[Zap] Server ready on http://${config.hostname}:${config.port}`
      );
    } catch (error) {
      // Clean up on error
      await this.stop();
      if (error instanceof ZapError) {
        throw error;
      }
      throw new ZapError(
        ZapErrorCode.UNKNOWN_ERROR,
        `Failed to start server: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * Set up process stdout/stderr handling
   */
  private setupProcessStreams(): void {
    if (!this.process?.stdout || !this.process?.stderr) return;

    // Forward stdout with prefix
    this.process.stdout.on("data", (data: Buffer) => {
      const output = data.toString().trim();
      if (output) {
        // Parse and format log output
        for (const line of output.split("\n")) {
          if (line.trim()) {
            console.log(`[Zap] ${line}`);
          }
        }
      }
    });

    // Forward stderr with error prefix
    this.process.stderr.on("data", (data: Buffer) => {
      const output = data.toString().trim();
      if (output) {
        for (const line of output.split("\n")) {
          if (line.trim()) {
            console.error(`[Zap] ${line}`);
          }
        }
      }
    });

    // Handle process exit
    this.process.on("exit", (code, signal) => {
      if (!this.isShuttingDown) {
        if (code !== 0 || signal) {
          console.error(`[Zap] Process exited unexpectedly: code=${code}, signal=${signal}`);
        }
      }
      this.process = null;
    });

    // Handle process errors
    this.process.on("error", (err) => {
      if (!this.isShuttingDown) {
        console.error(`[Zap] Process error:`, err);
      }
    });
  }

  /**
   * Poll the health check endpoint until the server is ready
   */
  private async waitForHealthy(
    hostname: string,
    port: number,
    healthPath: string,
    maxAttempts = 50,
    delayMs = 100
  ): Promise<void> {
    const url = `http://${hostname}:${port}${healthPath}`;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Check if process died while waiting
      if (!this.process || this.process.killed) {
        throw new ZapError(
          ZapErrorCode.SERVER_NOT_STARTED,
          "Server process died during startup"
        );
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1000);

        const response = await fetch(url, {
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.ok) {
          return;
        }
      } catch {
        // Server not ready yet, continue polling
      }

      // Log progress every 10 attempts
      if (attempt % 10 === 0) {
        console.log(`[Zap] Waiting for server... (attempt ${attempt}/${maxAttempts})`);
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    throw new ZapError(
      ZapErrorCode.REQUEST_TIMEOUT,
      `Server failed to start within ${maxAttempts * delayMs}ms`
    );
  }

  /**
   * Stop the server process gracefully
   * @param timeout - Maximum time to wait for graceful shutdown (ms)
   */
  async stop(timeout = 5000): Promise<void> {
    this.isShuttingDown = true;

    // Clean up config file
    this.cleanupConfigFile();

    if (!this.process) {
      return;
    }

    return new Promise((resolve) => {
      if (!this.process) {
        resolve();
        return;
      }

      // Set up timeout for forceful termination
      const forceTimeout = setTimeout(() => {
        console.log("[Zap] Force killing process (SIGKILL)");
        if (this.process && !this.process.killed) {
          this.process.kill("SIGKILL");
        }
        this.process = null;
        resolve();
      }, timeout);

      this.process.once("exit", () => {
        clearTimeout(forceTimeout);
        this.process = null;
        console.log("[Zap] Process stopped");
        resolve();
      });

      // Initiate graceful shutdown
      console.log("[Zap] Sending SIGTERM for graceful shutdown...");
      this.process.kill("SIGTERM");
    });
  }

  /**
   * Clean up the config file
   */
  private cleanupConfigFile(): void {
    if (this.configPath && existsSync(this.configPath)) {
      try {
        unlinkSync(this.configPath);
        this.configPath = null;
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Restart the server with new configuration
   */
  async restart(config: ZapConfig, logLevel: LogLevel = "info"): Promise<void> {
    if (this.restartCount >= this.maxRestarts) {
      throw new ZapError(
        ZapErrorCode.SERVER_NOT_STARTED,
        `Maximum restart attempts (${this.maxRestarts}) exceeded`
      );
    }

    console.log(`[Zap] Restarting server (attempt ${this.restartCount + 1}/${this.maxRestarts})...`);
    this.restartCount++;

    await this.stop();
    // Small delay to ensure clean shutdown
    await new Promise((resolve) => setTimeout(resolve, 100));
    await this.start(config, logLevel);

    // Reset restart count on successful restart
    this.restartCount = 0;
  }

  /**
   * Get the IPC socket path
   */
  getSocketPath(): string {
    return this.socketPath;
  }

  /**
   * Get the binary path being used
   */
  getBinaryPath(): string {
    return this.binaryPath;
  }

  /**
   * Check if the process is still running
   */
  isRunning(): boolean {
    return this.process !== null && !this.process.killed && !this.isShuttingDown;
  }

  /**
   * Get the process PID if running
   */
  getPid(): number | undefined {
    return this.process?.pid;
  }
}
