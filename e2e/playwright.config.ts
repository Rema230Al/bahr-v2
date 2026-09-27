import { defineConfig, devices } from "@playwright/test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

/** Isolated ports + a throwaway database so E2E never touches your dev data. */
const API_PORT = 3100;
const WEB_PORT = 5180;
export const WEB_URL = `http://localhost:${WEB_PORT}`;
export const ADMIN = { email: "e2e-admin@b7r.agency", password: "e2e-long-test-passphrase" };

const tmp = join(import.meta.dirname, ".tmp");
// The config is re-evaluated inside each worker; only the main process may reset the database.
if (!process.env.TEST_WORKER_INDEX) {
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
}

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: WEB_URL, trace: "retain-on-failure" },
  projects: [
    { name: "e2e", testMatch: /flows\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "e2e-mobile", testMatch: /flows\.spec\.ts/, use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    { name: "screens", testMatch: /screens\.spec\.ts/ },
  ],
  webServer: [
    {
      command: "bun src/index.ts",
      cwd: "../api",
      port: API_PORT,
      reuseExistingServer: false,
      env: {
        PORT: String(API_PORT),
        DATABASE_PATH: join(tmp, "e2e.sqlite"),
        ALLOWED_ORIGIN: WEB_URL,
        COOKIE_SECURE: "false",
        ADMIN_EMAIL: ADMIN.email,
        ADMIN_PASSWORD: ADMIN.password,
        // Both device projects share one IP; limiter behaviour itself is covered by the API tests.
        RATE_LIMIT_FORM_MAX: "50",
        RATE_LIMIT_LOGIN_MAX: "50",
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
