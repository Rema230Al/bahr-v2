import { defineConfig, devices } from "@playwright/test";

/**
 * Two modes:
 *  - local (default): isolated ports + a throwaway in-memory PostgreSQL, so E2E never touches your data.
 *  - live: LIVE_URL=https://… LIVE_ADMIN_EMAIL=… LIVE_ADMIN_PASSWORD=… npx playwright test
 *    runs the desktop flows against the deployed site. Credentials come only from the environment.
 *    The assistant test expects DEMO MODE on the server (AI_PROVIDER=demo); skip it with --grep-invert assistant otherwise.
 */
const LIVE_URL = process.env.LIVE_URL?.replace(/\/$/, "");
const API_PORT = 3100;
const WEB_PORT = 5180;
export const WEB_URL = LIVE_URL ?? `http://localhost:${WEB_PORT}`;
export const ADMIN = LIVE_URL
  ? { email: process.env.LIVE_ADMIN_EMAIL ?? "", password: process.env.LIVE_ADMIN_PASSWORD ?? "" }
  : { email: "e2e-admin@b7r.agency", password: "e2e-long-test-passphrase" };
if (LIVE_URL && (!ADMIN.email || !ADMIN.password)) throw new Error("Live mode needs LIVE_ADMIN_EMAIL and LIVE_ADMIN_PASSWORD");


export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: WEB_URL, trace: "retain-on-failure" },
  projects: LIVE_URL
    ? [{ name: "live", testMatch: /(flows|leads|date-filter|assistant)\.spec\.ts/, use: { ...devices["Desktop Chrome"] } }]
    : [
    { name: "e2e", testMatch: /(flows|leads|date-filter|assistant)\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "e2e-mobile", testMatch: /(flows|date-filter)\.spec\.ts/, use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    { name: "screens", testMatch: /screens\.spec\.ts/ },
  ],
  webServer: LIVE_URL ? undefined : [
    {
      command: "bun scripts/dev-local.ts --memory",
      cwd: "../api",
      port: API_PORT,
      reuseExistingServer: false,
      env: {
        PORT: String(API_PORT),
        SESSION_SECRET: "e2e-session-secret-long-enough-for-the-check",
        ALLOWED_ORIGIN: WEB_URL,
        COOKIE_SECURE: "false",
        ADMIN_EMAIL: ADMIN.email,
        ADMIN_PASSWORD: ADMIN.password,
        // Same calendar as the browser, so presets like "Today" mean the same day on both sides.
        ADMIN_TIME_ZONE: Intl.DateTimeFormat().resolvedOptions().timeZone,
        // Both device projects share one IP; limiter behaviour itself is covered by the API tests.
        RATE_LIMIT_FORM_MAX: "50",
        RATE_LIMIT_LOGIN_MAX: "50",
        // Always demo mode: E2E must never call an AI provider, even if api/.env has keys.
        AI_PROVIDER: "demo",
        ANTHROPIC_API_KEY: "",
        WORKERS_AI_TOKEN: "",
      },
    },
    {
      command: `bunx vite --port ${WEB_PORT} --strictPort`,
      cwd: "../web",
      port: WEB_PORT,
      reuseExistingServer: false,
      env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
    },
  ],
});
