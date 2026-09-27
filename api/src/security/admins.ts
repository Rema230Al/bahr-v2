import type { Db } from "../db";

// Verifying against this when the email is unknown keeps login timing uniform (no user enumeration).
const DUMMY_HASH = await Bun.password.hash("timing-equalizer-not-a-real-password", { algorithm: "argon2id" });

export function createAdmins(db: Db) {
  const byEmail = db.query(`SELECT id, email, password_hash FROM admins WHERE email = ?`);
  const insert = db.query(`INSERT INTO admins (email, password_hash) VALUES (?, ?) ON CONFLICT(email) DO NOTHING`);

  return {
    async create(email: string, password: string) {
      const hash = await Bun.password.hash(password, { algorithm: "argon2id" });
      insert.run(email.trim().toLowerCase(), hash);
    },
    /** Returns the admin on a correct email + password, otherwise null. */
    async authenticate(email: string, password: string) {
      const row = byEmail.get(email.trim().toLowerCase()) as { id: number; email: string; password_hash: string } | null;
      const ok = await Bun.password.verify(password, row?.password_hash ?? DUMMY_HASH);
      return row && ok ? { id: row.id, email: row.email } : null;
    },
  };
}

export type Admins = ReturnType<typeof createAdmins>;
