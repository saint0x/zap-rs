/**
 * Full Application Example
 *
 * Demonstrates a complete REST API with multiple endpoints,
 * middleware, error handling, and different HTTP methods.
 * Usage: bun examples/full-app.ts
 */

import Zap from "../src/index";

// Simple in-memory database
const db = new Map<string, any>([
  ["1", { id: "1", name: "Alice", email: "alice@example.com", age: 30 }],
  ["2", { id: "2", name: "Bob", email: "bob@example.com", age: 25 }],
]);

async function main() {
  const app = new Zap({ port: 3002 });

  // Enable middleware
  app.cors().logging();

  // ============================================================================
  // Health & Status Endpoints
  // ============================================================================

  app.get("/health", () => ({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }));

  app.get("/api/status", () => ({
    service: "User API",
    version: "1.0.0",
    status: "operational",
    endpoints: ["GET /api/users", "POST /api/users", "GET /api/users/:id", "PUT /api/users/:id", "DELETE /api/users/:id"],
  }));

  // ============================================================================
  // User CRUD Endpoints
  // ============================================================================

  // Get all users
  app.get("/api/users", () => ({
    success: true,
    data: Array.from(db.values()),
    count: db.size,
  }));

  // Get user by ID
  app.get("/api/users/:id", (req: any) => {
    const id = req.params?.id;
    const user = db.get(id);

    if (!user) {
      return {
        success: false,
        error: `User ${id} not found`,
        statusCode: 404,
      };
    }

    return {
      success: true,
      data: user,
    };
  });

  // Create new user
  app.post("/api/users", (req: any) => {
    try {
      const body = JSON.parse(req.body || "{}");
      const id = Math.random().toString(36).substring(7);
      const user = {
        id,
        ...body,
        createdAt: new Date().toISOString(),
      };

      db.set(id, user);

      return {
        success: true,
        message: "User created",
        data: user,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to create user: ${error.message}`,
      };
    }
  });

  // Update user
  app.put("/api/users/:id", (req: any) => {
    const id = req.params?.id;
    const user = db.get(id);

    if (!user) {
      return {
        success: false,
        error: `User ${id} not found`,
      };
    }

    try {
      const updates = JSON.parse(req.body || "{}");
      const updatedUser = { ...user, ...updates, updatedAt: new Date().toISOString() };
      db.set(id, updatedUser);

      return {
        success: true,
        message: "User updated",
        data: updatedUser,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to update user: ${error.message}`,
      };
    }
  });

  // Delete user
  app.delete("/api/users/:id", (req: any) => {
    const id = req.params?.id;
    const user = db.get(id);

    if (!user) {
      return {
        success: false,
        error: `User ${id} not found`,
      };
    }

    db.delete(id);

    return {
      success: true,
      message: "User deleted",
      data: user,
    };
  });

  // ============================================================================
  // Search and Filter
  // ============================================================================

  app.get("/api/users/search/:query", (req: any) => {
    const query = (req.params?.query || "").toLowerCase();
    const results = Array.from(db.values()).filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    );

    return {
      success: true,
      query,
      count: results.length,
      data: results,
    };
  });

  // ============================================================================
  // Statistics
  // ============================================================================

  app.get("/api/stats", () => {
    const users = Array.from(db.values());
    const avgAge = users.length > 0 ? users.reduce((sum, u) => sum + u.age, 0) / users.length : 0;

    return {
      success: true,
      stats: {
        totalUsers: users.length,
        averageAge: Math.round(avgAge * 10) / 10,
        oldestUser: Math.max(...users.map((u) => u.age)),
        youngestUser: Math.min(...users.map((u) => u.age)),
      },
    };
  });

  // ============================================================================
  // Error handling
  // ============================================================================

  app.get("/api/error", () => {
    throw new Error("Intentional error for testing");
  });

  await app.listen();

  console.log("✅ Full application running on http://127.0.0.1:3002");
  console.log("\n📚 Available endpoints:");
  console.log("   GET    /health                   - Health check");
  console.log("   GET    /api/status               - API status");
  console.log("   GET    /api/users                - Get all users");
  console.log("   GET    /api/users/:id            - Get user by ID");
  console.log("   POST   /api/users                - Create new user");
  console.log("   PUT    /api/users/:id            - Update user");
  console.log("   DELETE /api/users/:id            - Delete user");
  console.log("   GET    /api/users/search/:query  - Search users");
  console.log("   GET    /api/stats                - Get statistics");
  console.log("\n💡 Try some requests:");
  console.log("   curl http://127.0.0.1:3002/api/users");
  console.log("   curl http://127.0.0.1:3002/api/users/1");
  console.log("   curl -X POST http://127.0.0.1:3002/api/users -d '{\"name\":\"Charlie\",\"email\":\"charlie@example.com\",\"age\":28}'");
}

main().catch(console.error);
