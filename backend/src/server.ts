import "./config/redis.js";
import "./workers/email.worker.js";

import app from "./app.js";
import { env } from "./config/env.js";
import { initializeEmailService } from "./services/email.service.js";

async function startServer() {
  await initializeEmailService();

  const server = app.listen(env.PORT, () => {
    console.log(`🚀 Server running at http://localhost:${env.PORT}`);
    console.log(`❤️ Health check: http://localhost:${env.PORT}/health`);
    console.log(`⚙️ Worker concurrency: ${env.WORKER_CONCURRENCY}`);
  });

  process.on("SIGINT", () => {
    console.log("Shutting down server...");
    server.close(() => {
      process.exit(0);
    });
  });

  process.on("SIGTERM", () => {
    console.log("Shutting down server...");
    server.close(() => {
      process.exit(0);
    });
  });
}

startServer().catch((error) => {
  console.error("❌ Failed to start server:", error);
  process.exit(1);
});