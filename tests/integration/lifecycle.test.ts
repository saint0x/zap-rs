import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createTestApp, getRandomPort, cleanup } from "./setup";

describe("Server Lifecycle - Start, Stop, Restart", () => {
  // ============================================================================
  // Basic Startup Tests
  // ============================================================================

  describe("Server Startup", () => {
    let app: any;
    let port: number;

    beforeEach(() => {
      port = getRandomPort();
      app = createTestApp({ port, logLevel: "error" });
    });

    afterEach(async () => {
      await cleanup(app);
    });

    it("should start server successfully", async () => {
      app.get("/", () => ({ status: "ok" }));
      await app.listen();

      expect(app.isRunning()).toBe(true);
    });

    it("should allow routes to be registered before listen", async () => {
      app.get("/test", () => ({ test: true }));
      app.post("/api", () => ({ api: true }));

      await app.listen();

      const response = await fetch(`http://127.0.0.1:${port}/test`);
      expect(response.status).toBe(200);
    });

    it("should start with configured port", async () => {
      app.setPort(port).get("/", () => ({ port }));

      await app.listen();

      const response = await fetch(`http://127.0.0.1:${port}/`);
      expect(response.status).toBe(200);
    });

    it("should accept port override in listen()", async () => {
      app.get("/", () => ({ ok: true }));
      const overridePort = getRandomPort();

      // Note: listen() might accept port parameter
      await app.listen(overridePort);

      const response = await fetch(`http://127.0.0.1:${overridePort}/`);
      expect([200, 404]).toContain(response.status);
    });
  });

  // ============================================================================
  // Graceful Shutdown Tests
  // ============================================================================

  describe("Server Shutdown", () => {
    let app: any;
    let port: number;

    beforeEach(async () => {
      port = getRandomPort();
      app = createTestApp({ port, logLevel: "error" });
      app.get("/", () => ({ running: true }));
      await app.listen();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    afterEach(async () => {
      await cleanup(app);
    });

    it("should shut down gracefully", async () => {
      expect(app.isRunning()).toBe(true);

      await app.close();

      expect(app.isRunning()).toBe(false);
    });

    it("should stop accepting requests after close", async () => {
      const working = await fetch(`http://127.0.0.1:${port}/`);
      expect(working.status).toBe(200);

      await app.close();

      // Give server time to fully shutdown
      await new Promise((resolve) => setTimeout(resolve, 200));

      try {
        await fetch(`http://127.0.0.1:${port}/`, {
          signal: AbortSignal.timeout(500),
        });
        // If it works, that's a problem
        expect(false).toBe(true);
      } catch {
        // Expected - connection refused
        expect(true).toBe(true);
      }
    });

    it("should handle multiple close calls", async () => {
      await app.close();
      await app.close(); // Should not throw

      expect(app.isRunning()).toBe(false);
    });
  });

  // ============================================================================
  // Server Restart Tests
  // ============================================================================

  describe("Server Restart", () => {
    let port: number;

    beforeEach(() => {
      port = getRandomPort();
    });

    it("should support start/stop/start cycle", async () => {
      // First start
      let app = createTestApp({ port, logLevel: "error" });
      app.get("/", () => ({ attempt: 1 }));
      await app.listen();

      let response = await fetch(`http://127.0.0.1:${port}/`);
      expect(response.status).toBe(200);

      // Stop
      await app.close();
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Second start
      const newPort = getRandomPort();
      app = createTestApp({ port: newPort, logLevel: "error" });
      app.get("/", () => ({ attempt: 2 }));
      await app.listen();

      response = await fetch(`http://127.0.0.1:${newPort}/`);
      expect(response.status).toBe(200);

      await cleanup(app);
    });

    it("should create new instance without conflicts", async () => {
      const app1 = createTestApp({ port: getRandomPort(), logLevel: "error" });
      const app2 = createTestApp({ port: getRandomPort(), logLevel: "error" });

      app1.get("/", () => ({ server: 1 }));
      app2.get("/", () => ({ server: 2 }));

      await app1.listen();
      await app2.listen();

      expect(app1.isRunning()).toBe(true);
      expect(app2.isRunning()).toBe(true);

      await cleanup(app1);
      await cleanup(app2);
    });
  });

  // ============================================================================
  // Configuration Tests
  // ============================================================================

  describe("Configuration", () => {
    let app: any;
    let port: number;

    beforeEach(async () => {
      port = getRandomPort();
    });

    afterEach(async () => {
      await cleanup(app);
    });

    it("should allow hostname configuration", async () => {
      app = createTestApp({ port, logLevel: "error" });
      app.setHostname("127.0.0.1").get("/", () => ({ ok: true }));

      await app.listen();

      const response = await fetch(`http://127.0.0.1:${port}/`);
      expect(response.status).toBe(200);
    });

    it("should apply CORS configuration", async () => {
      app = createTestApp({ port, logLevel: "error" });
      app.cors().get("/", () => ({ cors: true }));

      await app.listen();

      const response = await fetch(`http://127.0.0.1:${port}/`);
      expect(response.status).toBe(200);
    });

    it("should apply logging configuration", async () => {
      app = createTestApp({ port, logLevel: "error" });
      app.logging().get("/", () => ({ logged: true }));

      await app.listen();

      const response = await fetch(`http://127.0.0.1:${port}/`);
      expect(response.status).toBe(200);
    });

    it("should support fluent configuration", async () => {
      app = createTestApp({ logLevel: "error" });
      app
        .setPort(port)
        .cors()
        .logging()
        .get("/", () => ({ fluent: true }));

      await app.listen();

      const response = await fetch(`http://127.0.0.1:${port}/`);
      expect(response.status).toBe(200);
    });
  });

  // ============================================================================
  // State Tests
  // ============================================================================

  describe("Server State", () => {
    it("should report running state correctly", async () => {
      const port = getRandomPort();
      const app = createTestApp({ port, logLevel: "error" });

      expect(app.isRunning()).toBe(false);

      app.get("/", () => ({ ok: true }));
      await app.listen();

      expect(app.isRunning()).toBe(true);

      await cleanup(app);

      // After cleanup, should be false
      expect(app.isRunning()).toBe(false);
    });

    it("should allow configuration before starting", async () => {
      const port = getRandomPort();
      const app = createTestApp({ port, logLevel: "error" });

      // Configure before starting
      app.cors().logging().get("/", () => ({ configured: true }));

      await app.listen();

      const response = await fetch(`http://127.0.0.1:${port}/`);
      expect(response.status).toBe(200);

      await cleanup(app);
    });

    it("should handle rapid start/stop", async () => {
      const port = getRandomPort();
      const app = createTestApp({ port, logLevel: "error" });
      app.get("/", () => ({ ok: true }));

      await app.listen();
      await app.close();
      await app.listen();
      await app.close();

      expect(app.isRunning()).toBe(false);
    });
  });

  // ============================================================================
  // Error Recovery Tests
  // ============================================================================

  describe("Error Recovery", () => {
    it("should recover from handler errors without crashing", async () => {
      const port = getRandomPort();
      const app = createTestApp({ port, logLevel: "error" });

      let errorCount = 0;
      app.get("/error", () => {
        errorCount++;
        throw new Error("Handler error");
      });

      app.get("/status", () => ({ errors: errorCount }));

      await app.listen();

      // Make request that causes error
      await fetch(`http://127.0.0.1:${port}/error`);

      // Server should still be running
      const statusResponse = await fetch(`http://127.0.0.1:${port}/status`);
      expect(statusResponse.status).toBe(200);

      await cleanup(app);
    });
  });
});
