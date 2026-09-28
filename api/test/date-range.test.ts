import { describe, expect, test } from "bun:test";
import { loadConfig } from "../src/config";
import { createRepo } from "../src/repo";
import { setup, validApplication, validInquiry } from "./helpers";

/**
 * Days are counted in the admin's time zone (Asia/Riyadh, UTC+3, by default), both ends inclusive.
 * Each row sits one minute either side of a range edge, so an off-by-one day or a UTC mix-up fails.
 */
const EDGES = [
  ["Before", "2025-12-14T20:59:00Z"], // Dec 14, 23:59 Riyadh — outside
  ["First", "2025-12-14T21:00:00Z"], //  Dec 15, 00:00 Riyadh — inside
  ["Last", "2026-01-20T20:59:00Z"], //   Jan 20, 23:59 Riyadh — inside
  ["After", "2026-01-20T21:00:00Z"], //  Jan 21, 00:00 Riyadh — outside
] as const;

async function seeded() {
  const ctx = await setup();
  const repo = createRepo(ctx.db);
  const { cookie } = await ctx.login();
  const opening = await ctx.createOpening(cookie);
  for (const [name, at] of EDGES) {
    const inquiryId = await repo.createInquiry({ ...validInquiry, name, company: null });
    await ctx.db`UPDATE inquiries SET created_at = ${at} WHERE id = ${inquiryId}`;
    await ctx.db`UPDATE leads SET created_at = ${at} WHERE inquiry_id = ${inquiryId}`;
    const appId = await repo.apply(opening.id, { ...validApplication(`${name.toLowerCase()}@example.com`), name });
    await ctx.db`UPDATE applications SET created_at = ${at} WHERE id = ${appId}`;
  }
  const names = async (path: string) => {
    const res = await ctx.call("GET", path, { cookie });
    expect(res.status).toBe(200);
    return ((await res.json()) as { name: string }[]).map((r) => r.name).sort();
  };
  return { ...ctx, cookie, opening, names };
}

describe("admin date range filter", () => {
  test("inquiries, leads and applications return only items created in the range (inclusive, admin time zone)", async () => {
    const { names, opening } = await seeded();
    const q = "?from=2025-12-15&to=2026-01-20";
    expect(await names(`/admin/inquiries${q}`)).toEqual(["First", "Last"]);
    expect(await names(`/admin/leads${q}`)).toEqual(["First", "Last"]);
    expect(await names(`/admin/openings/${opening.id}/applications${q}`)).toEqual(["First", "Last"]);
  });

  test("either end may be left open, and no range returns everything", async () => {
    const { names } = await seeded();
    expect(await names("/admin/inquiries?from=2025-12-15")).toEqual(["After", "First", "Last"]);
    expect(await names("/admin/leads?to=2026-01-20")).toEqual(["Before", "First", "Last"]);
    expect(await names("/admin/inquiries")).toEqual(["After", "Before", "First", "Last"]);
  });

  test("a single day works (from = to)", async () => {
    const { names } = await seeded();
    expect(await names("/admin/leads?from=2025-12-15&to=2025-12-15")).toEqual(["First"]);
  });

  test("the time zone is configurable, and an unknown zone stops the server from starting", async () => {
    // In UTC, 2025-12-14T21:00Z is still Dec 14, so it falls outside a range starting Dec 15.
    const { db, login, call } = await setup({ timeZone: "UTC" });
    const { cookie } = await login();
    const id = await createRepo(db).createInquiry({ ...validInquiry, company: null });
    await db`UPDATE inquiries SET created_at = ${"2025-12-14T21:00:00Z"} WHERE id = ${id}`;
    expect(await (await call("GET", "/admin/inquiries?from=2025-12-15", { cookie })).json()).toEqual([]);

    const env = { ALLOWED_ORIGIN: "http://localhost:5173", DATABASE_URL: "postgres://x@y/z", SESSION_SECRET: "s".repeat(32) };
    expect(loadConfig(env).timeZone).toBe("Asia/Riyadh");
    expect(() => loadConfig({ ...env, ADMIN_TIME_ZONE: "Mars/Olympus" })).toThrow(/ADMIN_TIME_ZONE/);
  });

  test("invalid dates and a 'to' before 'from' are refused with field errors", async () => {
    const { call, cookie, opening } = await seeded();
    const fields = async (path: string) => {
      const res = await call("GET", path, { cookie });
      expect(res.status).toBe(400);
      return ((await res.json()) as { fields: Record<string, string> }).fields;
    };
    expect(await fields("/admin/inquiries?from=2026-02-31")).toHaveProperty("from");
    expect(await fields("/admin/leads?to=20-01-2026")).toHaveProperty("to");
    expect(await fields("/admin/leads?from=yesterday")).toHaveProperty("from");
    expect(await fields("/admin/inquiries?from=2026-01-20&to=2025-12-15")).toHaveProperty("to");
    expect(await fields(`/admin/openings/${opening.id}/applications?from=2026-01-20&to=2025-12-15`)).toHaveProperty("to");
  });

  test("the filter is admin-only", async () => {
    const { call } = await seeded();
    expect((await call("GET", "/admin/inquiries?from=2025-12-15&to=2026-01-20")).status).toBe(401);
  });
});
