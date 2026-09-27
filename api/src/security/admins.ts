import type { Db } from "../db";

// Verifying against this when the email is unknown keeps login timing uniform (no user enumeration).
const DUMMY_HASH = await Bun.password.hash("timing-equalizer-not-a-real-password", { algorithm: "argon2id" });

export function createAdmins(sql: Db) {
  return {
    /** Creates the admin if that email doesn't exist yet. Never overwrites an existing account. */
    async create(email: string, password: string) {
      const hash = await Bun.password.hash(password, { algorithm: "argon2id" });
      await sql`INSERT INTO admins (email, password_hash) VALUES (${email.trim().toLowerCase()}, ${hash}) ON CONFLICT (email) DO NOTHING`;
    },
    /** Creates the admin, or replaces its password (used by scripts/set-admin.ts to rotate it). */
    async upsert(email: string, password: string) {
      const hash = await Bun.password.hash(password, { algorithm: "argon2id" });
      await sql`
        INSERT INTO admins (email, password_hash) VALUES (${email.trim().toLowerCase()}, ${hash})
        ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`;
      // rotating a password signs out every existing session for that admin
      await sql`DELETE FROM sessions WHERE admin_id = (SELECT id FROM admins WHERE email = ${email.trim().toLowerCase()})`;
    },
    /** Returns the admin on a correct email + password, otherwise null. */
    async authenticate(email: string, password: string) {
      const [row] = await sql<{ id: number; email: string; password_hash: string }[]>`
        SELECT id, email, password_hash FROM admins WHERE email = ${email.trim().toLowerCase()}`;
      const ok = await Bun.password.verify(password, row?.password_hash ?? DUMMY_HASH);
      return row && ok ? { id: row.id, email: row.email } : null;
    },
  };
}

export type Admins = ReturnType<typeof createAdmins>;
