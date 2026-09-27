import { describe, expect, test } from "bun:test";
import { ADMIN, ORIGIN, setup, validApplication, validInquiry } from "./helpers";

describe("input validation", () => {
  test("rejects a bad inquiry with field errors", async () => {
    const { call } = await setup();
    const res = await call("POST", "/inquiries", {
      body: { ...validInquiry, email: "not-an-email", service: "fishing", message: "hi" },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; fields: Record<string, string> };
    expect(body.error).toBe("validation");
    expect(Object.keys(body.fields)).toEqual(expect.arrayContaining(["email"]));
  });

  test("rejects whitespace-only names after trimming", async () => {
    const { call } = await setup();
    const res = await call("POST", "/inquiries", { body: { ...validInquiry, name: "     " } });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { fields: Record<string, string> }).fields.name).toBeDefined();
  });

  test("strips unknown fields (no mass assignment) and rejects oversized messages", async () => {
    const { call, db } = await setup();
    expect((await call("POST", "/inquiries", { body: { ...validInquiry, id: 999, created_at: "1999" } })).status).toBe(201);
    const [row] = await db<{ id: number; created_at: Date }[]>`SELECT id, created_at FROM inquiries`;
    expect(row!.id).not.toBe(999);
    expect(row!.created_at.getFullYear()).toBeGreaterThan(2000);
    expect((await call("POST", "/inquiries", { body: { ...validInquiry, message: "x".repeat(4001) } })).status).toBe(400);
  });

  test("rejects non-http portfolio links (e.g. javascript:)", async () => {
    const { call, login, createOpening } = await setup();
    const { cookie } = await login();
    const o = await createOpening(cookie);
    const res = await call("POST", `/openings/${o.id}/applications`, {
      body: { ...validApplication(), portfolio: "javascript:alert(1)" },
    });
    expect(res.status).toBe(400);
  });

  test("rejects a malformed JSON body and non-numeric ids", async () => {
    const { app } = await setup();
    const bad = await app.handle(
      new Request("http://api.test/inquiries", { method: "POST", headers: { "content-type": "application/json" }, body: "{nope" }),
    );
    expect(bad.status).toBe(400);
    const nonNumeric = await app.handle(new Request("http://api.test/openings/abc"));
    expect(nonNumeric.status).toBe(400);
  });

  test("honeypot submissions look successful but are not saved", async () => {
    const { call, db } = await setup();
    const res = await call("POST", "/inquiries", { body: { ...validInquiry, website: "http://spam.example" } });
    expect(res.status).toBe(201);
    const [row] = await db<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM inquiries`;
    expect(row!.n).toBe(0);
  });
});

describe("duplicate applications", () => {
  test("the same email cannot apply twice to the same opening (case-insensitive)", async () => {
    const { call, login, createOpening } = await setup();
    const { cookie } = await login();
    const o = await createOpening(cookie);
    const first = await call("POST", `/openings/${o.id}/applications`, { body: validApplication("sara@example.com") });
    expect(first.status).toBe(201);
    const again = await call("POST", `/openings/${o.id}/applications`, { body: validApplication("  SARA@Example.com ") });
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ error: "already_applied" });
  });

  test("the same email may apply to a different opening", async () => {
    const { call, login, createOpening } = await setup();
    const { cookie } = await login();
    const a = await createOpening(cookie, "Designer");
    const b = await createOpening(cookie, "Engineer");
    expect((await call("POST", `/openings/${a.id}/applications`, { body: validApplication() })).status).toBe(201);
    expect((await call("POST", `/openings/${b.id}/applications`, { body: validApplication() })).status).toBe(201);
  });

  test("applying to a missing opening is a 404", async () => {
    const { call } = await setup();
    expect((await call("POST", "/openings/999/applications", { body: validApplication() })).status).toBe(404);
  });
});

describe("admin-only permissions", () => {
  const adminRoutes: [string, string, unknown?][] = [
    ["GET", "/admin/me"],
    ["GET", "/admin/inquiries"],
    ["GET", "/admin/openings"],
    ["POST", "/admin/openings", { title: "X job", kind: "job", location: "Jeddah", description: "A long enough description." }],
    ["GET", "/admin/openings/1/applications"],
    ["POST", "/admin/openings/1/applications/1/accept"],
  ];

  test.each(adminRoutes)("%s %s without a session → 401", async (...[method, path, body]) => {
    const { call } = await setup();
    const res = await call(method, path, { body });
    expect(res.status).toBe(401);
  });

  test.each(adminRoutes)("%s %s with a forged cookie → 401", async (...[method, path, body]) => {
    const { call } = await setup();
    const res = await call(method, path, { body, cookie: "bahr_session=forged-token-value" });
    expect(res.status).toBe(401);
  });

  test("wrong password → 401 with a generic message", async () => {
    const { login } = await setup();
    const { res, cookie } = await login(ADMIN.email, "wrong-password-123");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "invalid_credentials" });
    expect(cookie).toBe("");
  });

  test("login sets an httpOnly, SameSite=Strict session cookie that unlocks admin routes", async () => {
    const { call, login } = await setup();
    const { res, cookie } = await login();
    expect(res.status).toBe(200);
    const header = res.headers.get("set-cookie")!;
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=Strict/i);
    expect(header).toMatch(/Path=\//);
    expect((await call("GET", "/admin/me", { cookie })).status).toBe(200);
  });

  test("secure mode uses a __Host- Secure cookie", async () => {
    const { login } = await setup({ cookieSecure: true });
    const { res } = await login();
    const header = res.headers.get("set-cookie")!;
    expect(header).toStartWith("__Host-bahr_session=");
    expect(header).toMatch(/Secure/);
  });

  test("logout invalidates the session server-side", async () => {
    const { call, login } = await setup();
    const { cookie } = await login();
    await call("POST", "/auth/logout", { cookie, headers: { origin: ORIGIN } });
    expect((await call("GET", "/admin/me", { cookie })).status).toBe(401);
  });

  test("admin writes from a foreign origin are refused (CSRF)", async () => {
    const { call, login } = await setup();
    const { cookie } = await login();
    const res = await call("POST", "/admin/openings", {
      cookie,
      headers: { origin: "https://evil.example" },
      body: { title: "X job", kind: "job", location: "Jeddah", description: "A long enough description." },
    });
    expect(res.status).toBe(403);
  });
});

describe("rate limiting", () => {
  test("public forms allow 5 submissions per window, then 429 with Retry-After", async () => {
    const { call } = await setup();
    for (let i = 0; i < 5; i++) {
      expect((await call("POST", "/inquiries", { body: validInquiry })).status).toBe(201);
    }
    const blocked = await call("POST", "/inquiries", { body: validInquiry });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  test("invalid submissions still count toward the limit", async () => {
    const { call } = await setup();
    for (let i = 0; i < 5; i++) await call("POST", "/inquiries", { body: { nope: true } });
    expect((await call("POST", "/inquiries", { body: validInquiry })).status).toBe(429);
  });

  test("limits are per client IP", async () => {
    const { call } = await setup();
    for (let i = 0; i < 6; i++) await call("POST", "/inquiries", { body: validInquiry, ip: "1.1.1.1" });
    expect((await call("POST", "/inquiries", { body: validInquiry, ip: "2.2.2.2" })).status).toBe(201);
  });

  test("login is rate limited against brute force", async () => {
    const { login } = await setup();
    for (let i = 0; i < 5; i++) await login(ADMIN.email, `guess-${i}-password`);
    const { res } = await login(); // even the right password is blocked now
    expect(res.status).toBe(429);
  });
});

describe("CORS and headers", () => {
  test("preflight from the frontend origin is allowed with credentials", async () => {
    const { app } = await setup();
    const res = await app.handle(
      new Request("http://api.test/inquiries", {
        method: "OPTIONS",
        headers: { origin: ORIGIN, "access-control-request-method": "POST" },
      }),
    );
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });

  test("other origins get no CORS allowance", async () => {
    const { app } = await setup();
    const res = await app.handle(
      new Request("http://api.test/openings", { headers: { origin: "https://evil.example" } }),
    );
    expect(res.headers.get("access-control-allow-origin")).not.toBe("https://evil.example");
  });

  test("security headers are on success and error responses", async () => {
    const { call } = await setup();
    for (const res of [await call("GET", "/health"), await call("GET", "/admin/me")]) {
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("x-frame-options")).toBe("DENY");
      expect(res.headers.get("strict-transport-security")).toContain("max-age=");
      expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
    }
  });
});
