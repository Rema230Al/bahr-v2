import { loadConfig } from "./config";
import { connect, migrate, waitForDb } from "./db";
import { createApp } from "./app";
import { createAdmins } from "./security/admins";

const config = loadConfig();
const sql = connect(config.databaseUrl, config.databasePoolMax);

await waitForDb(sql);
const applied = await migrate(sql);
if (applied.length) console.log(`Applied migrations: ${applied.join(", ")}`);

// Seed the first admin from env on boot. An existing admin is never overwritten
// (rotate a password with: bun scripts/set-admin.ts).
if (config.adminEmail && config.adminPassword) {
  await createAdmins(sql).create(config.adminEmail, config.adminPassword);
}

const app = createApp(config, sql).listen({ port: config.port, hostname: "0.0.0.0" });

console.log(`Bahr API listening on :${app.server?.port} (origin ${config.allowedOrigin}, assistant: ${config.ai.provider})`);

const shutdown = async () => {
  await app.stop();
  await sql.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
