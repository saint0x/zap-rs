/**
 * Zap IPC Architecture - Test Example
 *
 * This demonstrates the new IPC-based architecture where:
 * 1. TypeScript handlers are registered in this file
 * 2. The Rust binary is spawned with configuration
 * 3. All requests go through Rust -> IPC -> TypeScript -> Rust -> HTTP response
 */

import Zap from "./src/index";

async function main() {
  console.log("🚀 Zap IPC Architecture - Test Example\n");

  // Create a new Zap server instance
  const app = new Zap({
    port: 8080,
    hostname: "127.0.0.1",
    logLevel: "info",
  });

  // Enable CORS and logging middleware
  app.cors().logging();

  // ============================================================================
  // Route Handlers
  // ============================================================================

  // Simple GET route
  app.get("/", () => {
    console.log("📥 GET / received");
    return { message: "Hello from Zap IPC!", version: "2.0.0" };
  });

  // Route with parameters
  app.get("/api/users/:id", (req: any) => {
    console.log(`📥 GET /api/users/${req.params.id} received`);
    return {
      id: req.params.id,
      name: `User ${req.params.id}`,
      email: `user${req.params.id}@example.com`,
    };
  });

  // Route with query parameters
  app.get("/search", (req: any) => {
    console.log(`📥 GET /search with query:`, req.query);
    return {
      query: req.query,
      results: ["result1", "result2", "result3"],
    };
  });

  // POST route with body
  app.post("/api/users", (req: any) => {
    console.log(`📥 POST /api/users with body:`, req.body);
    return {
      created: true,
      id: 123,
      ...JSON.parse(req.body),
    };
  });

  // Async route
  app.post("/api/process", async (req: any) => {
    console.log("📥 POST /api/process received");

    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      status: "processed",
      timestamp: new Date().toISOString(),
    };
  });

  // Static files (commented out for test, requires actual directory)
  // app.static("/public", "./public");

  // ============================================================================
  // Start the Server
  // ============================================================================

  try {
    console.log("Starting Zap server with IPC architecture...\n");
    await app.listen();

    // Keep the process alive
    process.on("SIGTERM", async () => {
      console.log("\n📛 Received SIGTERM, shutting down...");
      await app.close();
      process.exit(0);
    });

    process.on("SIGINT", async () => {
      console.log("\n📛 Received SIGINT, shutting down...");
      await app.close();
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

main();
