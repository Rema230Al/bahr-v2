import { afterAll } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { connect, migrate, type Db } from "../src/db";

/**
 * A real PostgreSQL (PGlite: Postgres compiled to WebAssembly) served over the normal wire
 * protocol, so the app talks to it with the same driver it uses against Neon in production.
 * One connection: PGlite serves a single client at a time, and can't take a new client after one
 * disconnects — so the whole run shares one connection (real Postgres has no such limit).
 */
const pg = await PGlite.create();
const port = 40_000 + Math.floor(Math.random() * 20_000);
const server = new PGLiteSocketServer({ db: pg, port, host: "127.0.0.1" });
await server.start();

export const TEST_DATABASE_URL = `postgres://postgres@127.0.0.1:${port}/postgres?sslmode=disable`;

const current: Db = connect(TEST_DATABASE_URL, 1);
await migrate(current);

export const testDb = () => current;

/** Reads the database directly, bypassing the app's connection — proves writes were committed. */
export const rawQuery = async <T,>(query: string) => (await pg.query<T>(query)).rows;

export async function resetDb() {
  await current`TRUNCATE sessions, lead_activities, leads, applications, openings, inquiries, admins RESTART IDENTITY CASCADE`;
}

afterAll(async () => {
  await current.close();
  await server.stop();
  await pg.close();
});
