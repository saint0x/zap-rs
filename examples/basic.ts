/**
 * Basic Zap Example
 *
 * Demonstrates simple route registration and server startup.
 * Usage: bun examples/basic.ts
 */

import Zap from "../src/index";

async function main() {
  const app = new Zap({ port: 3000 });

  // Simple GET route
  app.getJson("/", () => ({
    message: "Hello from Zap!",
    framework: "Ultra-fast HTTP framework in Rust",
  }));

  // Route with path parameters
  app.getJson("/users/:id", (req: any) => ({
    userId: req.params?.id,
    message: `User ${req.params?.id} profile`,
  }));

  // POST route for creating data
  app.post("/api/data", (req: any) => ({
    received: req.body,
    timestamp: new Date().toISOString(),
  }));

  await app.listen();
  console.log("✅ Server running on http://127.0.0.1:3000");
}

main().catch(console.error);
