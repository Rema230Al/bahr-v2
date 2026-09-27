import { loadConfig } from "./config";
import { openDb } from "./db";
import { createApp } from "./app";
import { createAdmins } from "./security/admins";

const config = loadConfig();
const db = openDb(config.databasePath);

// Seed the first admin from env on boot. Existing admins are never overwritten.
if (config.adminEmail && config.adminPassword) {
  await createAdmins(db).create(config.adminEmail, config.adminPassword);
}

const app = createApp(config, db).listen({ port: config.port, hostname: "0.0.0.0" });

console.log(`Bahr API listening on :${app.server?.port} (origin ${config.allowedOrigin})`);

const shutdown = () => {
  app.stop();
  db.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
