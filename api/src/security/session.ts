import type { Db } from "../db";

/**
 * Sessions are random 256-bit tokens. The database stores only HMAC-SHA256(SESSION_SECRET, token):
 * a leaked database can't be replayed as cookies, and without the secret the hashes can't even be checked.
 */
export function createSessions(sql: Db, secret: string, ttlHours: number) {
  const ttlMs = ttlHours * 3_600_000;
  const hashToken = (token: string) => new Bun.CryptoHasher("sha256", secret).update(token).digest("hex");

  return {
    maxAgeSec: Math.floor(ttlMs / 1000),
    async create(adminId: number) {
      await sql`DELETE FROM sessions WHERE expires_at <= now()`;
      const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
      await sql`INSERT INTO sessions (token_hash, admin_id, expires_at) VALUES (${hashToken(token)}, ${adminId}, ${new Date(Date.now() + ttlMs)})`;
      return token;
    },
    async verify(token: string | undefined) {
      if (!token || token.length > 128) return null;
      const [row] = await sql<{ id: number; email: string; role: "admin" }[]>`
        SELECT a.id, a.email, a.role FROM sessions s JOIN admins a ON a.id = s.admin_id
        WHERE s.token_hash = ${hashToken(token)} AND s.expires_at > now()`;
      return row ?? null;
    },
    async destroy(token: string | undefined) {
      if (token) await sql`DELETE FROM sessions WHERE token_hash = ${hashToken(token)}`;
    },
  };
}

export type Sessions = ReturnType<typeof createSessions>;
