/**
 * Local development without installing PostgreSQL: starts PGlite (real Postgres compiled to
 * WebAssembly) and the API in ONE process. PGlite serves a single client, so the API uses a
 * one-connection pool here; with `bun --watch` both restart together and the data persists in
 * ./data/pglite. Production never runs this — it connects to the real DATABASE_URL (Neon).
 *
 *   bun scripts/dev-local.ts            persistent data in ./data/pglite
 *   bun scripts/dev-local.ts --memory   throwaway database (used by the E2E tests)
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const memory = process.argv.includes("--memory");
const pg = await PGlite.create(memory ? undefined : "./data/pglite");
const server = new PGLiteSocketServer({ db: pg, port: 0, host: "127.0.0.1" });
await server.start();
const port = (server as unknown as { server?: { address(): { port: number } } }).server?.address().port;
if (!port) throw new Error("Could not start the local PGlite server");

process.env.DATABASE_URL = `postgres://postgres@127.0.0.1:${port}/postgres?sslmode=disable`;
process.env.DATABASE_POOL_MAX = "1";
console.log(`Local PostgreSQL (PGlite${memory ? ", in memory" : ", ./data/pglite"}) on :${port}`);

await import("../src/index.ts");
