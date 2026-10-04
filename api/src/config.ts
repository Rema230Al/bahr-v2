import type { AssistantOptions, Provider } from "./assistant";

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
  /** Brief assistant: which provider writes the briefs, plus the limits every provider shares. */
  ai: AssistantOptions & { ipMax: number; ipWindowMs: number; dailyMax: number };
};

const PROVIDERS: Provider[] = ["anthropic", "workers-ai", "demo"];
/** Gemma 4 26B-A4B: ~4B active parameters, multilingual (Arabic included), cheap enough for the free tier. */
export const DEFAULT_WORKERS_AI_MODEL = "@cf/google/gemma-4-26b-a4b-it";

/**
 * AI_PROVIDER picks the provider. Unset keeps the old behaviour (Anthropic with a key, otherwise demo).
 * An explicit provider without its credentials fails at boot rather than silently going to demo.
 */
function aiProvider(env: Env) {
  const raw = env.AI_PROVIDER?.trim().toLowerCase() || (env.ANTHROPIC_API_KEY?.trim() ? "anthropic" : "demo");
  if (!PROVIDERS.includes(raw as Provider)) throw new Error(`AI_PROVIDER must be one of: ${PROVIDERS.join(", ")}`);
  const provider = raw as Provider;
  const anthropic = { apiKey: env.ANTHROPIC_API_KEY?.trim() || null, model: env.AI_MODEL?.trim() || "claude-opus-5-5" };
  const workersAi = {
    accountId: env.WORKERS_AI_ACCOUNT_ID?.trim() || null,
    apiToken: env.WORKERS_AI_TOKEN?.trim() || null,
    model: env.WORKERS_AI_MODEL?.trim() || DEFAULT_WORKERS_AI_MODEL,
  };
  if (provider === "anthropic" && !anthropic.apiKey) throw new Error("AI_PROVIDER=anthropic needs ANTHROPIC_API_KEY");
  if (provider === "workers-ai") {
    // The account id goes into the request URL: only a plain 32-hex Cloudflare id is accepted.
    if (!workersAi.accountId || !/^[0-9a-f]{32}$/i.test(workersAi.accountId)) {
      throw new Error("AI_PROVIDER=workers-ai needs WORKERS_AI_ACCOUNT_ID (your 32-character Cloudflare account id)");
    }
    if (!workersAi.apiToken) throw new Error("AI_PROVIDER=workers-ai needs WORKERS_AI_TOKEN (a Workers AI API token)");
    if (!/^@(cf|hf)\/[\w.-]+\/[\w.-]+$/.test(workersAi.model)) throw new Error("WORKERS_AI_MODEL must look like @cf/vendor/model");
  }
  return { provider, anthropic, workersAi };
}

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
    ai: {
      ...aiProvider(env),
      timeoutMs: int(env.AI_TIMEOUT_MS, 20_000),
      ipMax: int(env.RATE_LIMIT_AI_MAX, 5),
      ipWindowMs: int(env.RATE_LIMIT_AI_WINDOW_MS, 60 * 60_000),
      dailyMax: int(env.AI_DAILY_CAP, 200),
    },
  };
}
