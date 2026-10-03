import { describe, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { connect, migrate } from "../src/db";
import { ORIGIN, setup, validInquiry } from "./helpers";

type Lead = {
  id: number;
  inquiryId: number;
  stage: string;
  dealValue: number | null;
  ownerId: number | null;
  ownerEmail: string | null;
  followUpOn: string | null;
  lostReason: string | null;
  name: string;
  company: string | null;
  service: string;
  activities: { kind: string; body: string; by: string | null }[];
};

/** Logged-in admin with one lead created through the public "Let's talk" form. */
async function withLead() {
  const ctx = await setup();
  const { cookie } = await ctx.login();
  expect((await ctx.call("POST", "/inquiries", { body: validInquiry })).status).toBe(201);
  const [lead] = (await (await ctx.call("GET", "/admin/leads", { cookie })).json()) as Lead[];
  const patch = (body: unknown, headers: Record<string, string> = { origin: ORIGIN }) =>
    ctx.call("PATCH", `/admin/leads/${lead!.id}`, { cookie, body, headers });
  return { ...ctx, cookie, lead: lead!, patch };
}

describe("leads", () => {
  test("every inquiry becomes a lead in New with a 'created' activity", async () => {
    const { call, cookie, lead } = await withLead();
    expect(lead).toMatchObject({ stage: "new", name: validInquiry.name, company: validInquiry.company, service: "web", dealValue: null, ownerId: null });
    const detail = (await (await call("GET", `/admin/leads/${lead.id}`, { cookie })).json()) as Lead;
    expect(detail.activities).toHaveLength(1);
    expect(detail.activities[0]).toMatchObject({ kind: "created" });
  });

  test("the lead carries the client's form answers exactly, and inquiries link to their lead", async () => {
    const { call, cookie, lead } = await withLead();
    const detail = (await (await call("GET", `/admin/leads/${lead.id}`, { cookie })).json()) as Lead & Record<string, unknown>;
    expect(detail).toMatchObject({
      name: validInquiry.name,
      email: validInquiry.email,
      company: validInquiry.company,
      service: validInquiry.service,
      budget: validInquiry.budget,
      message: validInquiry.message,
      aiBrief: null,
    });
    expect(typeof detail.createdAt).toBe("string");
    const [inquiry] = (await (await call("GET", "/admin/inquiries", { cookie })).json()) as { lead_id: number }[];
    expect(inquiry!.lead_id).toBe(lead.id);
  });

  test("honeypot inquiries create no lead", async () => {
    const { call, login, db } = await setup();
    await call("POST", "/inquiries", { body: { ...validInquiry, website: "http://spam.example" } });
    await login();
    const [row] = await db<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM leads`;
    expect(row!.n).toBe(0);
  });

  test("moving through stages logs each move with who made it", async () => {
    const { patch } = await withLead();
    expect((await patch({ stage: "contacted" })).status).toBe(200);
    const res = await patch({ stage: "won" });
    const lead = (await res.json()) as Lead;
    expect(lead.stage).toBe("won");
    expect(lead.activities.map((a) => a.body)).toEqual(
      expect.arrayContaining(["Moved from New to Contacted", "Moved from Contacted to Won"]),
    );
    expect(lead.activities[0]!.by).toBe("admin@b7r.agency");
  });

  test("moving to Lost requires a reason; leaving Lost clears it", async () => {
    const { patch } = await withLead();
    const noReason = await patch({ stage: "lost" });
    expect(noReason.status).toBe(400);
    expect(((await noReason.json()) as { fields: Record<string, string> }).fields.lostReason).toBeDefined();
    expect((await patch({ stage: "lost", lostReason: "   " })).status).toBe(400);

    const lost = (await (await patch({ stage: "lost", lostReason: "  Went with a cheaper agency " })).json()) as Lead;
    expect(lost).toMatchObject({ stage: "lost", lostReason: "Went with a cheaper agency" });
    expect(lost.activities[0]!.body).toBe("Moved from New to Lost — Went with a cheaper agency");

    const back = (await (await patch({ stage: "contacted" })).json()) as Lead;
    expect(back).toMatchObject({ stage: "contacted", lostReason: null });
    expect((await patch({ lostReason: "not lost" })).status).toBe(400);
  });

  test("deal value, owner and follow-up date are validated and saved", async () => {
    const { patch, db } = await withLead();
    const [me] = await db<{ id: number }[]>`SELECT id FROM admins`;

    for (const bad of [{ dealValue: -1 }, { dealValue: 1.5 }, { dealValue: "lots" }, { dealValue: 2_000_000_000 }]) {
      expect((await patch(bad)).status).toBe(400);
    }
    for (const bad of [{ followUpOn: "2026-02-31" }, { followUpOn: "tomorrow" }]) {
      expect((await patch(bad)).status).toBe(400);
    }
    expect((await patch({ ownerId: 9999 })).status).toBe(400);
    expect((await patch({ stage: "closed" })).status).toBe(400);

    const lead = (await (await patch({ dealValue: 120000, ownerId: me!.id, followUpOn: "2026-10-05" })).json()) as Lead;
    expect(lead).toMatchObject({ dealValue: 120000, ownerId: me!.id, ownerEmail: "admin@b7r.agency", followUpOn: "2026-10-05" });
    expect(lead.activities.map((a) => a.body)).toEqual(
      expect.arrayContaining(["Deal value set to SAR 120,000", "Owner set to admin@b7r.agency", "Follow-up set for 2026-10-05"]),
    );

    const cleared = (await (await patch({ dealValue: null, followUpOn: null })).json()) as Lead;
    expect(cleared).toMatchObject({ dealValue: null, followUpOn: null });
  });

  test("a patch that changes nothing adds no activity", async () => {
    const { patch } = await withLead();
    const lead = (await (await patch({ stage: "new" })).json()) as Lead;
    expect(lead.activities).toHaveLength(1);
  });

  test("unknown fields are refused (no mass assignment)", async () => {
    const { patch, lead, db } = await withLead();
    await patch({ inquiryId: 999, stage: "contacted" });
    const [row] = await db<{ inquiry_id: number }[]>`SELECT inquiry_id FROM leads WHERE id = ${lead.id}`;
    expect(row!.inquiry_id).not.toBe(999);
  });

  test("notes are trimmed, validated and added to the timeline", async () => {
    const { call, cookie, lead } = await withLead();
    const note = (body: unknown) => call("POST", `/admin/leads/${lead.id}/notes`, { cookie, body, headers: { origin: ORIGIN } });
    expect((await note({ body: "   " })).status).toBe(400);
    expect((await note({ body: "x".repeat(2001) })).status).toBe(400);
    const res = await note({ body: "  Called — wants a proposal by Thursday.  " });
    expect(res.status).toBe(201);
    const updated = (await res.json()) as Lead;
    expect(updated.activities[0]).toMatchObject({ kind: "note", body: "Called — wants a proposal by Thursday." });
  });

  test("missing leads are 404, bad ids 400", async () => {
    const { call, cookie } = await withLead();
    expect((await call("GET", "/admin/leads/999", { cookie })).status).toBe(404);
    expect((await call("PATCH", "/admin/leads/999", { cookie, body: { stage: "won" }, headers: { origin: ORIGIN } })).status).toBe(404);
    expect((await call("POST", "/admin/leads/999/notes", { cookie, body: { body: "hi" }, headers: { origin: ORIGIN } })).status).toBe(404);
    expect((await call("GET", "/admin/leads/abc", { cookie })).status).toBe(400);
  });

  test("lead edits from a foreign origin are refused (CSRF)", async () => {
    const { patch } = await withLead();
    expect((await patch({ stage: "won" }, { origin: "https://evil.example" })).status).toBe(403);
  });

  test("the admins list (for owners) exposes only id and email", async () => {
    const { call, cookie } = await withLead();
    const admins = (await (await call("GET", "/admin/admins", { cookie })).json()) as Record<string, unknown>[];
    expect(admins).toHaveLength(1);
    expect(Object.keys(admins[0]!).sort()).toEqual(["email", "id"]);
  });
});

describe("leads migration", () => {
  test("converts inquiries that existed before it into New leads", async () => {
    // A separate database that stops at 001, gets an inquiry, then receives 002.
    const pg = await PGlite.create();
    const dir = join(import.meta.dir, "..", "migrations");
    await pg.exec(readFileSync(join(dir, "001_init.sql"), "utf8"));
    await pg.exec(`
      CREATE TABLE schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
      INSERT INTO schema_migrations (name) VALUES ('001_init.sql');
      INSERT INTO inquiries (name, email, service, budget, message, created_at)
        VALUES ('Old Inquiry', 'old@example.com', 'ai', 'not-sure', 'Sent before the CRM existed.', '2026-01-02T10:00:00Z');`);
    const port = 40_000 + Math.floor(Math.random() * 20_000);
    const server = new PGLiteSocketServer({ db: pg, port, host: "127.0.0.1" });
    await server.start();
    const sql = connect(`postgres://postgres@127.0.0.1:${port}/postgres?sslmode=disable`, 1);
    try {
      expect(await migrate(sql)).toEqual(["002_leads.sql", "003_inquiry_ai_brief.sql"]);
      const [lead] = await sql<{ stage: string; name: string; created_at: Date }[]>`SELECT stage, name, created_at FROM lead_cards`;
      expect(lead).toMatchObject({ stage: "new", name: "Old Inquiry" });
      expect(new Date(lead!.created_at).toISOString()).toBe("2026-01-02T10:00:00.000Z");
      const [act] = await sql<{ kind: string }[]>`SELECT kind FROM lead_activities`;
      expect(act!.kind).toBe("created");
    } finally {
      await sql.close();
      await server.stop();
      await pg.close();
    }
  });
});
