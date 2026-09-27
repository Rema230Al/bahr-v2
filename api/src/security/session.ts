import type { Db } from "../db";

/** Only a SHA-256 of the session token is stored, so a leaked database can't be replayed as cookies. */
const hashToken = (token: string) => new Bun.CryptoHasher("sha256").update(token).digest("hex");

export function createSessions(db: Db, ttlHours: number) {
  const ttlMs = ttlHours * 3_600_000;
  const insert = db.query(`INSERT INTO sessions (token_hash, admin_id, expires_at) VALUES (?, ?, ?)`);
  const find = db.query(
    `SELECT a.id, a.email, a.role FROM sessions s JOIN admins a ON a.id = s.admin_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
  );
  const remove = db.query(`DELETE FROM sessions WHERE token_hash = ?`);
  const purge = db.query(`DELETE FROM sessions WHERE expires_at <= ?`);

  return {
    maxAgeSec: Math.floor(ttlMs / 1000),
    create(adminId: number) {
      purge.run(Date.now());
      const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
      insert.run(hashToken(token), adminId, Date.now() + ttlMs);
      return token;
    },
    verify(token: string | undefined) {
      if (!token || token.length > 128) return null;
      return find.get(hashToken(token), Date.now()) as { id: number; email: string; role: "admin" } | null;
    },
    destroy(token: string | undefined) {
      if (token) remove.run(hashToken(token));
    },
  };
}

export type Sessions = ReturnType<typeof createSessions>;
