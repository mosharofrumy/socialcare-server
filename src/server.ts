import app from "./app.js";
import { closeMongoDB, connectToMongoDB } from "./config/db.js";
import { env } from "./config/env.js";

async function startServer(): Promise<void> {
  try {
    await connectToMongoDB();
    const server = app.listen(env.port, () => {
      console.log(`Social Care server is running on port ${env.port}`);
    });

    const shutdown = async (): Promise<void> => {
      server.close(async (error) => {
        if (error) {
          console.error("Server shutdown error:", error);
          process.exitCode = 1;
        }
        await closeMongoDB();
      });
    };

    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  } catch (error) {
    console.error("Server startup error:", error);
    await closeMongoDB();
    process.exitCode = 1;
  }
}

void startServer();
