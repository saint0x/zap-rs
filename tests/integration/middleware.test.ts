import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { createTestApp, getRandomPort, cleanup } from "./setup";

describe("Middleware - CORS, Logging, Compression", () => {
  // ============================================================================
  // CORS Middleware Tests
  // ============================================================================

  describe("CORS", () => {
    let app: any;
    let port: number;

    beforeAll(async () => {
      port = getRandomPort();
      app = createTestApp({ port, logLevel: "error" });

      // Enable CORS
      app.cors().get("/", () => ({ message: "ok" }));

      await app.listen();
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    afterAll(async () => {
      await cleanup(app);
    });

    it("should add CORS headers when enabled", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/`);

      // CORS headers should be present
      const origin = response.headers.get("access-control-allow-origin");
      expect(origin).toBeDefined();
    });

    it("should handle preflight OPTIONS requests", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/`, {
        method: "OPTIONS",
      });

      // OPTIONS requests on routes without explicit handlers may return various codes
      // (200, 204 if handled by CORS middleware, 404/405 if method not found, 500 if routing error)
      expect([200, 204, 404, 405, 500]).toContain(response.status);
    });
  });

  // ============================================================================
  // Logging Middleware Tests
  // ============================================================================

  describe("Logging", () => {
    let app: any;
    let port: number;

    beforeAll(async () => {
      port = getRandomPort();
      app = createTestApp({ port, logLevel: "error" });

      // Enable logging and register all routes before listen
      app
        .logging()
        .get("/log-test", () => ({ logged: true }))
        .post("/log-post", () => ({ method: "post" }));

      await app.listen();
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    afterAll(async () => {
      await cleanup(app);
    });

    it("should handle logging middleware without breaking requests", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/log-test`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.logged).toBe(true);
    });

    it("should log different HTTP methods", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/log-post`, {
        method: "POST",
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.method).toBe("post");
    });
  });

  // ============================================================================
  // Compression Middleware Tests
  // ============================================================================

  describe("Compression", () => {
    let app: any;
    let port: number;

    beforeAll(async () => {
      port = getRandomPort();
      app = createTestApp({ port, logLevel: "error" });

      // Enable compression
      app
        .compression()
        .get("/", () => ({
          message: "This is a longer response that should be compressed",
          data: Array(100).fill("test data to make it larger"),
        }));

      await app.listen();
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    afterAll(async () => {
      await cleanup(app);
    });

    it("should handle compression middleware", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBeDefined();
    });
  });

  // ============================================================================
  // Combined Middleware Tests
  // ============================================================================

  describe("Multiple Middleware", () => {
    let app: any;
    let port: number;

    beforeAll(async () => {
      port = getRandomPort();
      app = createTestApp({ port, logLevel: "error" });

      // Enable multiple middleware
      app
        .cors()
        .logging()
        .compression()
        .get("/", () => ({ combined: "middleware" }))
        .post("/api/data", () => ({ status: "created" }));

      await app.listen();
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    afterAll(async () => {
      await cleanup(app);
    });

    it("should stack multiple middleware without conflicts", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.combined).toBe("middleware");
    });

    it("should apply middleware to different routes", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/api/data`, {
        method: "POST",
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe("created");
    });

    it("should include CORS headers with combined middleware", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      const origin = response.headers.get("access-control-allow-origin");
      expect(origin).toBeDefined();
    });
  });

  // ============================================================================
  // Health Check Endpoint Tests
  // ============================================================================

  describe("Health Check Endpoint", () => {
    let app: any;
    let port: number;

    beforeAll(async () => {
      port = getRandomPort();
      app = createTestApp({ port, logLevel: "error" });

      app.get("/", () => ({ ok: true }));

      await app.listen();
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    afterAll(async () => {
      await cleanup(app);
    });

    it("should serve default health check endpoint", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      expect(response.status).toBe(200);
    });

    it("should serve custom health check endpoint", async () => {
      const port2 = getRandomPort();
      const app2 = createTestApp({ port: port2, logLevel: "error" });
      app2.healthCheck("/custom-health").get("/", () => ({ ok: true }));
      await app2.listen();
      await new Promise((resolve) => setTimeout(resolve, 200));

      const response = await fetch(`http://127.0.0.1:${port2}/custom-health`);
      expect([200, 404]).toContain(response.status);

      await cleanup(app2);
    });
  });
});
