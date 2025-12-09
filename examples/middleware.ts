/**
 * Middleware Example
 *
 * Demonstrates CORS, logging, and compression middleware.
 * Usage: bun examples/middleware.ts
 */

import Zap from "../src/index";

async function main() {
  const app = new Zap({ port: 3001 });

  // Enable middleware
  app
    .cors() // Enable CORS headers for cross-origin requests
    .logging() // Enable request logging
    .compression() // Enable response compression
    .healthCheck("/api/health"); // Custom health check endpoint

  // Health check endpoint
  app.get("/api/health", () => ({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }));

  // Public API endpoint (benefits from CORS and logging)
  app.getJson("/api/public/data", () => ({
    data: [
      { id: 1, name: "Item 1" },
      { id: 2, name: "Item 2" },
      { id: 3, name: "Item 3" },
    ],
  }));

  // Create endpoint with logging
  app.post("/api/items", (req: any) => ({
    success: true,
    created: true,
    item: {
      id: Math.random().toString(36).substring(7),
      ...JSON.parse(req.body || "{}"),
      createdAt: new Date().toISOString(),
    },
  }));

  await app.listen();
  console.log("✅ Server with middleware running on http://127.0.0.1:3001");
  console.log("   CORS: Enabled ✓");
  console.log("   Logging: Enabled ✓");
  console.log("   Compression: Enabled ✓");
  console.log("   Health check: /api/health");
}

main().catch(console.error);
