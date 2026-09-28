/** All runtime configuration comes from environment variables — nothing secret lives in code. */
export type Config = {
  port: number;
  databaseUrl: string;
  databasePoolMax: number;
  /** Key for HMAC-ing session tokens before they are stored. */
  sessionSecret: string;
  allowedOrigin: string;
  cookieSecure: boolean;
  sessionTtlHours: number;
  /** Header that carries the real client IP when it is set by a trusted proxy (e.g. "fly-client-ip"). */
  ipHeader: string | null;
  /** Shared secret the Cloudflare Worker sends so we can trust its forwarded client IP. */
  proxySecret: string | null;
  adminEmail: string | null;
  adminPassword: string | null;
  /** IANA zone whose calendar days the admin date filter uses (e.g. "Asia/Riyadh"). */
  timeZone: string;
  rateLimit: { formMax: number; formWindowMs: number; loginMax: number; loginWindowMs: number };
};

type Env = Record<string, string | undefined>;

const int = (v: string | undefined, fallback: number) => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export function loadConfig(env: Env = process.env): Config {
  const allowedOrigin = env.ALLOWED_ORIGIN?.trim();
  if (!allowedOrigin) throw new Error("ALLOWED_ORIGIN is required (e.g. https://bybahr.com)");
  try {
    new URL(allowedOrigin);
  } catch {
    throw new Error("ALLOWED_ORIGIN must be a full origin such as https://bybahr.com");
  }

  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl || !/^postgres(ql)?:\/\//.test(databaseUrl)) {
    throw new Error("DATABASE_URL is required (postgres://user:pass@host/db)");
  }
  const sessionSecret = env.SESSION_SECRET ?? "";
  if (sessionSecret.length < 32) throw new Error("SESSION_SECRET is required (32+ random characters)");

  const adminPassword = env.ADMIN_PASSWORD || null;
  if (adminPassword && adminPassword.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters");
  }

  const timeZone = env.ADMIN_TIME_ZONE?.trim() || "Asia/Riyadh";
  try {
    new Intl.DateTimeFormat("en", { timeZone });
  } catch {
    throw new Error(`ADMIN_TIME_ZONE "${timeZone}" is not a valid IANA time zone`);
  }

  return {
    port: int(env.PORT, 3000),
    databaseUrl,
    databasePoolMax: int(env.DATABASE_POOL_MAX, 10),
    sessionSecret,
    allowedOrigin: allowedOrigin.replace(/\/$/, ""),
    cookieSecure: env.COOKIE_SECURE !== "false",
    sessionTtlHours: int(env.SESSION_TTL_HOURS, 8),
    ipHeader: env.CLIENT_IP_HEADER?.toLowerCase() || null,
    proxySecret: env.PROXY_SECRET || null,
    adminEmail: env.ADMIN_EMAIL?.trim().toLowerCase() || null,
    adminPassword,
    timeZone,
    rateLimit: {
      formMax: int(env.RATE_LIMIT_FORM_MAX, 5),
      formWindowMs: int(env.RATE_LIMIT_FORM_WINDOW_MS, 10 * 60_000),
      loginMax: int(env.RATE_LIMIT_LOGIN_MAX, 5),
      loginWindowMs: int(env.RATE_LIMIT_LOGIN_WINDOW_MS, 15 * 60_000),
    },
  };
}
