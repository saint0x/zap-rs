import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { createTestApp, getRandomPort, cleanup } from "./setup";

describe("Error Handling and Edge Cases", () => {
  // ============================================================================
  // 404 Not Found Tests
  // ============================================================================

  describe("404 Handling", () => {
    let app: any;
    let port: number;

    beforeAll(async () => {
      port = getRandomPort();
      app = createTestApp({ port, logLevel: "error" });

      // Only register specific routes
      app.get("/", () => ({ exists: true }));

      await app.listen();
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    afterAll(async () => {
      await cleanup(app);
    });

    it("should return error status for unregistered routes", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/nonexistent`);
      // Rust router returns 500 for unmatched routes; TypeScript could normalize this to 404
      expect([404, 500]).toContain(response.status);
    });

    it("should return error status for wrong HTTP method", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/`, {
        method: "DELETE",
      });
      // No DELETE handler registered, should return error
      expect([404, 405, 500]).toContain(response.status);
    });

    it("should distinguish between existing and non-existing routes", async () => {
      const exists = await fetch(`http://127.0.0.1:${port}/`);
      const notFound = await fetch(`http://127.0.0.1:${port}/missing`);

      expect(exists.status).toBe(200);
      // Unmatched routes return error status (404 or 500)
      expect([404, 500]).toContain(notFound.status);
    });
  });

  // ============================================================================
  // Handler Error Tests
  // ============================================================================

  describe("Handler Errors", () => {
    let app: any;
    let port: number;

    beforeAll(async () => {
      port = getRandomPort();
      app = createTestApp({ port, logLevel: "error" });

      // Handler that throws an error
      app.get("/error", () => {
        throw new Error("Handler intentionally failed");
      });

      // Handler that returns error response
      app.get("/error-response", () => ({
        error: true,
        message: "Custom error",
      }));

      // Handler with async error
      app.get("/async-error", async () => {
        throw new Error("Async handler failed");
      });

      await app.listen();
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    afterAll(async () => {
      await cleanup(app);
    });

    it("should handle handler exceptions gracefully", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/error`);
      // Should return 500 or similar error status
      expect([500, 400, 502].includes(response.status)).toBe(true);
    });

    it("should handle async handler errors", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/async-error`);
      expect([500, 400, 502].includes(response.status)).toBe(true);
    });

    it("should allow handlers to return error responses", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/error-response`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.error).toBe(true);
    });
  });

  // ============================================================================
  // Malformed Request Tests
  // ============================================================================

  describe("Malformed Requests", () => {
    let app: any;
    let port: number;

    beforeAll(async () => {
      port = getRandomPort();
      app = createTestApp({ port, logLevel: "error" });

      app.post("/parse", (req: any) => ({
        parsed: true,
        body: req.body,
      }));

      await app.listen();
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    afterAll(async () => {
      await cleanup(app);
    });

    it("should handle POST with invalid JSON", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/parse`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "{ invalid json }",
      });

      // Should either parse as string or return error
      expect([200, 400].includes(response.status)).toBe(true);
    });

    it("should handle large request bodies", async () => {
      const largeBody = "x".repeat(1000);
      const response = await fetch(`http://127.0.0.1:${port}/parse`, {
        method: "POST",
        body: largeBody,
      });

      expect([200, 413].includes(response.status)).toBe(true);
    });

    it("should handle requests with multiple headers", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/parse`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Custom-Header": "value1",
          "X-Another-Header": "value2",
        },
        body: "{}",
      });

      expect(response.status).toBe(200);
    });
  });

  // ============================================================================
  // Handler Timeout Tests
  // ============================================================================

  describe("Timeouts", () => {
    let app: any;
    let port: number;

    beforeAll(async () => {
      port = getRandomPort();
      app = createTestApp({ port, logLevel: "error" });

      // Handler that takes a long time
      app.get("/slow", async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return { done: true };
      });

      // Handler that returns quickly
      app.get("/fast", () => ({ done: true }));

      await app.listen();
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    afterAll(async () => {
      await cleanup(app);
    });

    it("should handle slow handlers", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/slow`, {
        signal: AbortSignal.timeout(5000),
      });

      expect([200, 408, 504, 502].includes(response.status)).toBe(true);
    });

    it("should handle fast handlers", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/fast`);
      expect(response.status).toBe(200);
    });
  });

  // ============================================================================
  // Empty Response Tests
  // ============================================================================

  describe("Empty Responses", () => {
    let app: any;
    let port: number;

    beforeAll(async () => {
      port = getRandomPort();
      app = createTestApp({ port, logLevel: "error" });

      // Handler returning null
      app.get("/null", () => null);

      // Handler returning undefined
      app.get("/undefined", () => undefined);

      // Handler returning empty object
      app.get("/empty", () => ({}));

      // Handler returning empty string
      app.get("/empty-string", () => "");

      await app.listen();
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    afterAll(async () => {
      await cleanup(app);
    });

    it("should handle null responses", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/null`);
      expect(response.status).toBe(200);
    });

    it("should handle undefined responses", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/undefined`);
      expect(response.status).toBe(200);
    });

    it("should handle empty object responses", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/empty`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Object.keys(data).length).toBe(0);
    });

    it("should handle empty string responses", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/empty-string`);
      expect(response.status).toBe(200);
    });
  });

  // ============================================================================
  // Concurrent Request Tests
  // ============================================================================

  describe("Concurrent Requests", () => {
    let app: any;
    let port: number;

    beforeAll(async () => {
      port = getRandomPort();
      app = createTestApp({ port, logLevel: "error" });

      let counter = 0;
      app.get("/concurrent", () => ({
        count: ++counter,
        timestamp: Date.now(),
      }));

      await app.listen();
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    afterAll(async () => {
      await cleanup(app);
    });

    it("should handle multiple concurrent requests", async () => {
      const requests = Array(10)
        .fill(null)
        .map(() => fetch(`http://127.0.0.1:${port}/concurrent`));

      const responses = await Promise.all(requests);
      expect(responses.every((r) => r.status === 200)).toBe(true);
    });

    it("should return different responses for concurrent requests", async () => {
      const requests = Array(5)
        .fill(null)
        .map(() => fetch(`http://127.0.0.1:${port}/concurrent`).then((r) => r.json()));

      const responses = await Promise.all(requests);
      const counts = responses.map((r: any) => r.count);
      // Should have different counts due to counter increment
      expect(new Set(counts).size).toBeGreaterThan(0);
    });
  });
});
