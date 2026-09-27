import { describe, expect, test } from "bun:test";
import { migrate } from "../src/db";
import { createRepo } from "../src/repo";
import { rawQuery } from "./db";
import { setup, validApplication, validInquiry } from "./helpers";

type AppRow = { id: number; status: string; email: string };

describe("migrations", () => {
  test("are recorded and safe to run again (every boot runs them)", async () => {
    const { db } = await setup();
    expect(await migrate(db)).toEqual([]); // nothing new to apply
    const rows = await db<{ name: string }[]>`SELECT name FROM schema_migrations ORDER BY name`;
    expect(rows.map((r) => r.name)).toContain("001_init.sql");
  });
});

describe("data is saved", () => {
  test("an inquiry is stored with trimmed, normalised values and shown to the admin", async () => {
    const { call, login, db } = await setup();
    const res = await call("POST", "/inquiries", {
      body: { ...validInquiry, name: "  Noura Al-Harbi  ", email: "Noura@Example.COM" },
    });
    expect(res.status).toBe(201);

    const [row] = await db`SELECT * FROM inquiries`;
    expect(row).toMatchObject({ name: "Noura Al-Harbi", email: "noura@example.com", service: "web", budget: "50k-150k" });

    const { cookie } = await login();
    const list = (await (await call("GET", "/admin/inquiries", { cookie })).json()) as unknown[];
    expect(list).toHaveLength(1);
  });

  test("openings and applications are committed to PostgreSQL (visible outside the app's connection)", async () => {
    const { db } = await setup();
    const repo1 = createRepo(db);
    const o = await repo1.createOpening({ title: "Motion Designer", kind: "job", location: "Remote", description: "Make depth move beautifully." });
    await repo1.apply(o.id, { name: "Lama", email: "lama@example.com", portfolio: "https://lama.work", message: "Hello Bahr team!" });

    const openings = await rawQuery<{ title: string }>("SELECT title FROM openings");
    const applications = await rawQuery<{ email: string }>("SELECT email FROM applications");
    expect(openings.map((r) => r.title)).toEqual(["Motion Designer"]);
    expect(applications.map((r) => r.email)).toEqual(["lama@example.com"]);
  });
});

describe("only one applicant can be accepted", () => {
  test("accepting closes the opening, marks the rest not selected, and blocks new applications", async () => {
    const { call, login, createOpening, db } = await setup();
    const { cookie } = await login();
    const o = await createOpening(cookie);

    const ids: number[] = [];
    for (const email of ["a@example.com", "b@example.com", "c@example.com"]) {
      const res = await call("POST", `/openings/${o.id}/applications`, { body: validApplication(email) });
      ids.push(((await res.json()) as { id: number }).id);
    }

    const accept = await call("POST", `/admin/openings/${o.id}/applications/${ids[1]}/accept`, { cookie });
    expect(accept.status).toBe(200);
    expect(((await accept.json()) as { status: string }).status).toBe("closed");

    const rows = await db<AppRow[]>`SELECT id, status, email FROM applications ORDER BY id`;
    expect(rows.map((r) => r.status)).toEqual(["not_selected", "accepted", "not_selected"]);
    const [opening] = await db`SELECT status, accepted_application_id AS a FROM openings`;
    expect(opening).toEqual({ status: "closed", a: ids[1]! });

    // A second accept fails, and the opening takes no new applications.
    const second = await call("POST", `/admin/openings/${o.id}/applications/${ids[0]}/accept`, { cookie });
    expect(second.status).toBe(409);
    const late = await call("POST", `/openings/${o.id}/applications`, { body: validApplication("late@example.com") });
    expect(late.status).toBe(409);
    expect(await late.json()).toEqual({ error: "opening_closed" });
  });

  test("two accepts fired at the same time → exactly one wins", async () => {
    const { call, login, createOpening, db } = await setup();
    const { cookie } = await login();
    const o = await createOpening(cookie);
    const a = (await (await call("POST", `/openings/${o.id}/applications`, { body: validApplication("x@example.com") })).json()) as { id: number };
    const b = (await (await call("POST", `/openings/${o.id}/applications`, { body: validApplication("y@example.com") })).json()) as { id: number };

    const results = await Promise.all([
      call("POST", `/admin/openings/${o.id}/applications/${a.id}/accept`, { cookie }),
      call("POST", `/admin/openings/${o.id}/applications/${b.id}/accept`, { cookie }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const [row] = await db<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM applications WHERE status = 'accepted'`;
    expect(row!.n).toBe(1);
  });

  test("the database itself refuses a second accepted row", async () => {
    const { db } = await setup();
    const repo = createRepo(db);
    const o = await repo.createOpening({ title: "Engineer", kind: "job", location: "Jeddah", description: "Build the backend of depth." });
    const a = await repo.apply(o.id, { name: "A", email: "a@x.com", portfolio: "https://a.x", message: "Hello there!" });
    const b = await repo.apply(o.id, { name: "B", email: "b@x.com", portfolio: "https://b.x", message: "Hello there!" });
    await db`UPDATE applications SET status = 'accepted' WHERE id = ${a}`;
    const err = await db`UPDATE applications SET status = 'accepted' WHERE id = ${b}`.then(() => null, (e: { errno?: string }) => e);
    expect(err?.errno).toBe("23505"); // unique_violation on one_accepted_per_opening
  });

  test("an applicant from a different opening cannot be accepted", async () => {
    const { call, login, createOpening } = await setup();
    const { cookie } = await login();
    const o1 = await createOpening(cookie, "Designer");
    const o2 = await createOpening(cookie, "Engineer");
    const app = (await (await call("POST", `/openings/${o2.id}/applications`, { body: validApplication() })).json()) as { id: number };
    const res = await call("POST", `/admin/openings/${o1.id}/applications/${app.id}/accept`, { cookie });
    expect(res.status).toBe(404);
  });
});
