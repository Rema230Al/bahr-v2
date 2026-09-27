import { loadConfig, type Config } from "../src/config";
import { resetDb, TEST_DATABASE_URL, testDb } from "./db";
import { createApp } from "../src/app";
import { createAdmins } from "../src/security/admins";

export const ORIGIN = "http://localhost:5173";
export const ADMIN = { email: "admin@b7r.agency", password: "correct-horse-battery" };

let ipCounter = 0;
/** Each test gets its own client IP so rate-limit budgets don't bleed between tests. */
export const freshIp = () => `10.0.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;

export async function setup(overrides: Partial<Config> = {}) {
  const config: Config = {
    ...loadConfig({
      ALLOWED_ORIGIN: ORIGIN,
      COOKIE_SECURE: "false",
      CLIENT_IP_HEADER: "x-test-ip",
      DATABASE_URL: TEST_DATABASE_URL,
      SESSION_SECRET: "test-session-secret-that-is-long-enough-123",
    }),
    ...overrides,
  };
  await resetDb();
  const db = testDb();
  await createAdmins(db).create(ADMIN.email, ADMIN.password);
  const app = createApp(config, db);
  const ip = freshIp();

  const call = (method: string, path: string, opts: { body?: unknown; cookie?: string; ip?: string; headers?: Record<string, string> } = {}) =>
    app.handle(
      new Request(`http://api.test${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          "x-test-ip": opts.ip ?? ip,
          ...(opts.cookie ? { cookie: opts.cookie } : {}),
          ...opts.headers,
        },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      }),
    );

  const login = async (email = ADMIN.email, password = ADMIN.password) => {
    const res = await call("POST", "/auth/login", { body: { email, password }, headers: { origin: ORIGIN } });
    const setCookie = res.headers.get("set-cookie") ?? "";
    return { res, cookie: setCookie.split(";")[0] ?? "" };
  };

  const createOpening = async (cookie: string, title = "Senior Frontend Engineer") => {
    const res = await call("POST", "/admin/openings", {
      cookie,
      body: { title, kind: "job", location: "Jeddah", description: "Build cinematic web experiences with depth." },
    });
    return (await res.json()) as { id: number; status: string };
  };

  return { app, db, config, call, login, createOpening };
}

export const validInquiry = {
  name: "Noura Al-Harbi",
  email: "noura@example.com",
  company: "Example Co",
  service: "web",
  budget: "50k-150k",
  message: "We need a new website for our clinic network.",
};

export const validApplication = (email = "sara@example.com") => ({
  name: "Sara Khalid",
  email,
  portfolio: "https://sara.design",
  message: "I'd love to help Bahr build deeper experiences.",
});
