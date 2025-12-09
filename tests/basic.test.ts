import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import Zap from "../src/index";

describe("Basic Zap Server Tests", () => {
  let app: Zap;

  beforeAll(async () => {
    // Create a new Zap instance
    app = new Zap({ port: 3001, logLevel: "error" });

    // Register some test routes
    app.get("/", () => ({ message: "Hello, World!" }));
    app.get("/hello/:name", (req: any) => ({
      greeting: `Hello, ${req.params.name}!`,
    }));
    app.post("/echo", (req: any) => ({
      echoed: req.body,
      method: req.method,
    }));

    // Start the server
    await app.listen();
  });

  afterAll(async () => {
    // Close the server
    await app.close();
  });

  it("should return 200 for GET /", async () => {
    const response = await fetch("http://127.0.0.1:3001/");
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.message).toBe("Hello, World!");
  });

  it("should handle path parameters", async () => {
    const response = await fetch("http://127.0.0.1:3001/hello/Alice");
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.greeting).toBe("Hello, Alice!");
  });

  it("should handle POST requests", async () => {
    const response = await fetch("http://127.0.0.1:3001/echo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ test: "data" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.method).toBe("POST");
  });

  it("should check server is running", () => {
    expect(app.isRunning()).toBe(true);
  });
});
