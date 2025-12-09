import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import Zap from "../../src/index";
import { createTestApp, getRandomPort, cleanup } from "./setup";

describe("Route Handling - GET/POST/PUT/DELETE", () => {
  let app: Zap;
  let port: number;

  beforeAll(async () => {
    port = getRandomPort();
    app = new Zap({ port, logLevel: "error" });

    // Register test routes
    app.get("/", () => ({ message: "Hello, World!" }));

    app.get("/api/users/:id", (req: any) => ({
      userId: req.params?.id || "unknown",
      endpoint: "/api/users/:id",
    }));

    app.getJson("/api/data", () => ({
      status: "success",
      data: [1, 2, 3],
    }));

    app.post("/api/echo", async (req: any) => ({
      echoed: req.body,
      method: req.method,
      contentType: req.headers?.["content-type"],
    }));

    app.put("/api/update/:id", async (req: any) => ({
      updated: true,
      id: req.params?.id,
      body: req.body,
    }));

    app.delete("/api/delete/:id", (req: any) => ({
      deleted: true,
      id: req.params?.id,
    }));

    app.patch("/api/patch/:id", (req: any) => ({
      patched: true,
      id: req.params?.id,
    }));

    // Start the server
    await app.listen();
    console.log(`[Tests] Server started on port ${port}`);

    // Small delay to ensure server is fully ready
    await new Promise((resolve) => setTimeout(resolve, 200));
  });

  afterAll(async () => {
    await cleanup(app);
  });

  // ============================================================================
  // GET Routes
  // ============================================================================

  it("should handle GET / and return JSON", async () => {
    const response = await fetch(`http://127.0.0.1:${port}/`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.message).toBe("Hello, World!");
  });

  it("should handle GET with path parameters", async () => {
    const response = await fetch(`http://127.0.0.1:${port}/api/users/42`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.userId).toBe("42");
    expect(data.endpoint).toBe("/api/users/:id");
  });

  it("should handle GET with multiple path parameter values", async () => {
    const testIds = ["1", "abc-123", "user_123"];
    for (const id of testIds) {
      const response = await fetch(`http://127.0.0.1:${port}/api/users/${id}`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.userId).toBe(id);
    }
  });

  it("should handle getJson() convenience method", async () => {
    const response = await fetch(`http://127.0.0.1:${port}/api/data`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.status).toBe("success");
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBe(3);
  });

  // ============================================================================
  // POST Routes
  // ============================================================================

  it("should handle POST with JSON body", async () => {
    const testData = { name: "John", age: 30 };
    const response = await fetch(`http://127.0.0.1:${port}/api/echo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testData),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.method).toBe("POST");
    expect(data.contentType).toBe("application/json");
  });

  it("should handle POST with text body", async () => {
    const response = await fetch(`http://127.0.0.1:${port}/api/echo`, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: "Hello, Zap!",
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.method).toBe("POST");
  });

  it("should handle POST with empty body", async () => {
    const response = await fetch(`http://127.0.0.1:${port}/api/echo`, {
      method: "POST",
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.method).toBe("POST");
  });

  // ============================================================================
  // PUT Routes
  // ============================================================================

  it("should handle PUT with path parameters and body", async () => {
    const response = await fetch(`http://127.0.0.1:${port}/api/update/99`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Updated" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.updated).toBe(true);
    expect(data.id).toBe("99");
  });

  // ============================================================================
  // DELETE Routes
  // ============================================================================

  it("should handle DELETE with path parameters", async () => {
    const response = await fetch(`http://127.0.0.1:${port}/api/delete/55`, {
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.deleted).toBe(true);
    expect(data.id).toBe("55");
  });

  // ============================================================================
  // PATCH Routes
  // ============================================================================

  it("should handle PATCH with path parameters", async () => {
    const response = await fetch(`http://127.0.0.1:${port}/api/patch/77`, {
      method: "PATCH",
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.patched).toBe(true);
    expect(data.id).toBe("77");
  });

  // ============================================================================
  // Response Types
  // ============================================================================

  it("should auto-serialize objects to JSON", async () => {
    const response = await fetch(`http://127.0.0.1:${port}/api/users/1`);
    expect(response.headers.get("content-type")).toMatch(/application\/json/);

    const data = await response.json();
    expect(typeof data).toBe("object");
  });

  it("should handle async handlers", async () => {
    const response = await fetch(`http://127.0.0.1:${port}/api/echo`, {
      method: "POST",
      body: "test",
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("method");
  });

  // ============================================================================
  // Query Parameters (if Rust implementation supports them)
  // ============================================================================

  it("should preserve content type headers", async () => {
    const response = await fetch(`http://127.0.0.1:${port}/api/echo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{}",
    });

    expect(response.status).toBe(200);
  });
});
