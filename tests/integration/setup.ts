import Zap from "../../src/index";

/**
 * Helper to create a test Zap instance on a random port
 */
export function createTestApp(
  options?: { port?: number; logLevel?: "trace" | "debug" | "info" | "warn" | "error" }
): Zap {
  const port = options?.port || getRandomPort();
  return new Zap({
    port,
    logLevel: options?.logLevel || "error",
  });
}

/**
 * Get a random available port in the 40000-60000 range
 */
export function getRandomPort(): number {
  return Math.floor(Math.random() * 20000) + 40000;
}

/**
 * Wait for server to be ready by pinging health check
 */
export async function waitForServer(port: number, timeout = 5000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`, {
        signal: AbortSignal.timeout(500),
      });
      if (response.ok) return;
    } catch {
      // Still starting up
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Server on port ${port} failed to start within ${timeout}ms`);
}

/**
 * Cleanup helper - closes server and waits for process to exit
 */
export async function cleanup(app: Zap): Promise<void> {
  if (app && app.isRunning()) {
    await app.close();
    // Give process time to fully exit
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
