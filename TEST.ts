import Zap from "./src/index";

async function main(): Promise<void> {
  console.log("🔥 Starting Zap server on port 8080...");
  const app = new Zap({ port: 8080 });

  // Register routes
  app.getJson("/", () => {
    console.log("📥 GET / request received!");
    return { message: "Hello from Zap!", port: 8080, timestamp: new Date().toISOString() };
  });

  app.getJson("/api/users/:id", (req: any) => {
    console.log(`📥 GET /api/users/${req.params?.id} request received!`);
    return { userId: req.params?.id, name: `User ${req.params?.id}` };
  });

  app.post("/api/echo", (req: any) => {
    console.log("📥 POST /api/echo request received!");
    return { echoed: req.body, method: req.method };
  });

  app.cors().logging().get("/health", () => ({ status: "ok", uptime: process.uptime() }));

  console.log("📡 Starting Zap server...");
  await app.listen(8080);

  console.log("✅ Zap server running on http://127.0.0.1:8080");
  console.log("📝 Try these URLs:");
  console.log("   - http://127.0.0.1:8080/");
  console.log("   - http://127.0.0.1:8080/api/users/123");
  console.log("   - POST http://127.0.0.1:8080/api/echo");

  // Keep process alive
  setInterval(() => {
    process.stdout.write(".");
  }, 5000);
}

main().catch(console.error);