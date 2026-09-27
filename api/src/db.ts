import { SQL } from "bun";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type Db = SQL;

const MIGRATIONS_DIR = join(import.meta.dir, "..", "migrations");
/** Arbitrary constant: only one process may run migrations at a time. */
const MIGRATION_LOCK = 7_211_947;

export function connect(url: string, max = 10): Db {
  return new SQL(url, { max, idleTimeout: 30, connectionTimeout: 10 });
}

/** Waits for the database to accept connections (containers can start before it is reachable). */
export async function waitForDb(sql: Db, attempts = 20) {
  for (let i = 1; ; i++) {
    try {
      await sql`select 1`;
      return;
    } catch (e) {
      if (i >= attempts) throw e;
      await Bun.sleep(Math.min(3000, 250 * i));
    }
  }
}

/**
 * Applies every migrations/NNN_*.sql not yet recorded in schema_migrations, in order, inside one
 * transaction guarded by an advisory lock — safe to run on every boot and from several machines.
 */
export async function migrate(sql: Db) {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  const applied: string[] = [];
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(${MIGRATION_LOCK})`;
    await tx`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
    const done = new Set((await tx`SELECT name FROM schema_migrations`).map((r: { name: string }) => r.name));
    for (const file of files) {
      if (done.has(file)) continue;
      await tx.unsafe(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
      await tx`INSERT INTO schema_migrations (name) VALUES (${file})`;
      applied.push(file);
    }
  });
  return applied;
}

/** Postgres error 23505 = unique_violation (Bun puts the SQLSTATE in `errno`). */
export const isUniqueViolation = (e: unknown) => {
  const err = e as { errno?: string; code?: string } | null;
  return err?.errno === "23505" || err?.code === "23505";
};
