import { describe, expect, test } from "bun:test";
import { setup, validInquiry } from "./helpers";

const answers = { lang: "en", idea: "A booking app for our clinic network", audience: "Patients in Jeddah", features: "Online booking" };

describe("brief assistant", () => {
  test("demo mode (no API key) returns a sample brief with the four sections and no prices", async () => {
    const { call, config } = await setup();
    expect(config.ai.apiKey).toBeNull();
    const res = await call("POST", "/assistant/brief", { body: answers });
    expect(res.status).toBe(200);
    const { brief, demo } = (await res.json()) as { brief: string; demo: boolean };
    expect(demo).toBe(true);
    for (const h of ["Summary", "Goals", "Key features", "Best-fit Bahr service"]) expect(brief).toContain(h);
    expect(brief).toContain(answers.idea);
    expect(brief).not.toMatch(/SAR|\$|price|budget/i);

    const ar = (await (await call("POST", "/assistant/brief", { body: { ...answers, lang: "ar" } })).json()) as { brief: string };
    expect(ar.brief).toContain("الملخص");
  });

  test("input is validated and capped on the server", async () => {
    const base = await setup();
    const { call } = await setup({ ai: { ...base.config.ai, ipMax: 50 } });
    const status = async (body: unknown) => (await call("POST", "/assistant/brief", { body })).status;
    expect(await status({ ...answers, idea: "short" })).toBe(400);
    expect(await status({ ...answers, idea: "          too short " })).toBe(400);
    expect(await status({ ...answers, idea: "x".repeat(601) })).toBe(400);
    expect(await status({ ...answers, audience: "x".repeat(301) })).toBe(400);
    expect(await status({ ...answers, lang: "fr" })).toBe(400);
    const res = await call("POST", "/assistant/brief", { body: { ...answers, idea: undefined } });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "validation" });
    // Another site's page can't spend our budget.
    expect((await call("POST", "/assistant/brief", { body: answers, headers: { origin: "https://evil.example" } })).status).toBe(403);
  });

  test("rate limited per IP, and by a global daily cap across all IPs", async () => {
    const { call } = await setup({ ai: { apiKey: null, model: "x", timeoutMs: 1000, ipMax: 2, ipWindowMs: 60_000, dailyMax: 3 } });
    const ask = (ip: string) => call("POST", "/assistant/brief", { body: answers, ip });
    expect((await ask("1.1.1.1")).status).toBe(200);
    expect((await ask("1.1.1.1")).status).toBe(200);
    const limited = await ask("1.1.1.1");
    expect(limited.status).toBe(429);
    expect(await limited.json()).toMatchObject({ error: "rate_limited" });

    expect((await ask("2.2.2.2")).status).toBe(200); // 3rd of 3 for the day
    expect((await ask("3.3.3.3")).status).toBe(429); // fresh IP, but the daily cap is spent
  });

  test("the edited brief is saved with the inquiry and shown to the admin as plain text", async () => {
    const { call, login } = await setup();
    const brief = "Summary\n<script>alert(1)</script> <b>bold</b>‮\u0007\r\n- Goal one";
    expect((await call("POST", "/inquiries", { body: { ...validInquiry, aiBrief: brief } })).status).toBe(201);
    expect((await call("POST", "/inquiries", { body: { ...validInquiry, aiBrief: "x".repeat(2001) } })).status).toBe(400);

    const { cookie } = await login();
    const [lead] = (await (await call("GET", "/admin/leads", { cookie })).json()) as { id: number }[];
    const res = await call("GET", `/admin/leads/${lead!.id}`, { cookie });
    expect(res.headers.get("content-type")).toContain("application/json");
    const detail = (await res.json()) as { aiBrief: string };
    // Markup kept verbatim as text (the admin renders it as a text node); control / bidi-override chars stripped.
    expect(detail.aiBrief).toBe("Summary\n<script>alert(1)</script> <b>bold</b>\n- Goal one");
    const [inquiry] = (await (await call("GET", "/admin/inquiries", { cookie })).json()) as { ai_brief: string }[];
    expect(inquiry!.ai_brief).toBe(detail.aiBrief);
  });
});

