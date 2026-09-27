import { isUniqueViolation, type Db } from "./db";
import { acceptApplicant, canApply, OpeningClosedError, type Opening, type OpeningKind } from "./domain/opening";

type OpeningRow = {
  id: number;
  title: string;
  kind: OpeningKind;
  location: string;
  description: string;
  status: "open" | "closed";
  accepted_application_id: number | null;
  created_at: Date;
  closed_at: Date | null;
};

const toOpening = (r: OpeningRow): Opening => ({
  id: r.id,
  title: r.title,
  kind: r.kind,
  location: r.location,
  description: r.description,
  status: r.status,
  acceptedApplicationId: r.accepted_application_id,
  createdAt: new Date(r.created_at).toISOString(),
  closedAt: r.closed_at ? new Date(r.closed_at).toISOString() : null,
});

export class NotFoundError extends Error {}
export class DuplicateApplicationError extends Error {}

export function createRepo(sql: Db) {
  const getOpening = async (id: number) => {
    const [row] = await sql<OpeningRow[]>`SELECT * FROM openings WHERE id = ${id}`;
    return row ? toOpening(row) : null;
  };

  return {
    async createInquiry(i: { name: string; email: string; company: string | null; service: string; budget: string; message: string }) {
      const [row] = await sql<{ id: number }[]>`
        INSERT INTO inquiries (name, email, company, service, budget, message)
        VALUES (${i.name}, ${i.email}, ${i.company}, ${i.service}, ${i.budget}, ${i.message})
        RETURNING id`;
      return row!.id;
    },
    listInquiries: () => sql`SELECT * FROM inquiries ORDER BY id DESC LIMIT 500`,

    async createOpening(o: { title: string; kind: OpeningKind; location: string; description: string }) {
      const [row] = await sql<OpeningRow[]>`
        INSERT INTO openings (title, kind, location, description)
        VALUES (${o.title}, ${o.kind}, ${o.location}, ${o.description})
        RETURNING *`;
      return toOpening(row!);
    },
    getOpening,
    async listOpenings() {
      const rows = await sql<OpeningRow[]>`SELECT * FROM openings ORDER BY status = 'closed', id DESC`;
      return rows.map(toOpening);
    },
    async listOpeningsWithCounts() {
      const rows = await sql<(OpeningRow & { applicants: number })[]>`
        SELECT o.*, (SELECT COUNT(*)::int FROM applications a WHERE a.opening_id = o.id) AS applicants
        FROM openings o ORDER BY o.status = 'closed', o.id DESC`;
      return rows.map((r) => ({ ...toOpening(r), applicants: r.applicants }));
    },

    /** Inserts only while the opening is still open — checked in the same statement, so no race with an accept. */
    async apply(openingId: number, a: { name: string; email: string; portfolio: string; message: string }) {
      const opening = await getOpening(openingId);
      if (!opening) throw new NotFoundError("Opening not found");
      if (!canApply(opening)) throw new OpeningClosedError();
      try {
        const [row] = await sql<{ id: number }[]>`
          INSERT INTO applications (opening_id, name, email, portfolio, message)
          SELECT ${openingId}, ${a.name}, ${a.email}, ${a.portfolio}, ${a.message}
          WHERE EXISTS (SELECT 1 FROM openings WHERE id = ${openingId} AND status = 'open')
          RETURNING id`;
        if (!row) throw new OpeningClosedError();
        return row.id;
      } catch (e) {
        if (isUniqueViolation(e)) throw new DuplicateApplicationError("Already applied");
        throw e;
      }
    },
    listApplications: (openingId: number) =>
      sql`SELECT * FROM applications WHERE opening_id = ${openingId} ORDER BY id ASC`,

    /**
     * Accepts one applicant and closes the opening, atomically. SELECT … FOR UPDATE locks the
     * opening row, so two concurrent accepts run one after the other and the second sees it closed.
     * The partial unique index (one accepted row per opening) is the final backstop.
     */
    accept(openingId: number, applicationId: number): Promise<Opening> {
      return sql.begin(async (tx) => {
        const [row] = await tx<OpeningRow[]>`SELECT * FROM openings WHERE id = ${openingId} FOR UPDATE`;
        if (!row) throw new NotFoundError("Opening not found");
        const closed = acceptApplicant(toOpening(row), applicationId); // throws if already closed
        const [app] = await tx<{ status: string }[]>`
          SELECT status FROM applications WHERE id = ${applicationId} AND opening_id = ${openingId} FOR UPDATE`;
        if (!app) throw new NotFoundError("Applicant not found");
        if (app.status !== "pending") throw new OpeningClosedError();
        try {
          await tx`UPDATE applications SET status = 'accepted' WHERE id = ${applicationId}`;
        } catch (e) {
          if (isUniqueViolation(e)) throw new OpeningClosedError();
          throw e;
        }
        await tx`
          UPDATE applications SET status = 'not_selected'
          WHERE opening_id = ${openingId} AND id <> ${applicationId} AND status = 'pending'`;
        await tx`
          UPDATE openings SET status = 'closed', accepted_application_id = ${applicationId}, closed_at = ${closed.closedAt}
          WHERE id = ${openingId}`;
        return closed;
      });
    },
  };
}

export type Repo = ReturnType<typeof createRepo>;
