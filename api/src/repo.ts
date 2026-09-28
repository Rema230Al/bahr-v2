import { isUniqueViolation, type Db } from "./db";
import { acceptApplicant, canApply, OpeningClosedError, type Opening, type OpeningKind } from "./domain/opening";
import { applyLeadPatch, LeadValidationError, type LeadPatch, type Stage } from "./domain/lead";

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

type LeadRow = {
  id: number;
  inquiry_id: number;
  stage: Stage;
  deal_value: number | null;
  owner_id: number | null;
  owner_email: string | null;
  follow_up_on: string | null;
  lost_reason: string | null;
  created_at: Date;
  updated_at: Date;
  name: string;
  email: string;
  company: string | null;
  service: string;
  budget: string;
  message: string;
};

const toLead = (r: LeadRow) => ({
  id: r.id,
  inquiryId: r.inquiry_id,
  stage: r.stage,
  dealValue: r.deal_value,
  ownerId: r.owner_id,
  ownerEmail: r.owner_email,
  followUpOn: r.follow_up_on,
  lostReason: r.lost_reason,
  createdAt: new Date(r.created_at).toISOString(),
  updatedAt: new Date(r.updated_at).toISOString(),
  name: r.name,
  email: r.email,
  company: r.company,
  service: r.service,
  budget: r.budget,
  message: r.message,
});

type ActivityRow = { id: number; kind: string; body: string; admin_email: string | null; created_at: Date };

export class NotFoundError extends Error {}
export class DuplicateApplicationError extends Error {}

export function createRepo(sql: Db) {
  const getOpening = async (id: number) => {
    const [row] = await sql<OpeningRow[]>`SELECT * FROM openings WHERE id = ${id}`;
    return row ? toOpening(row) : null;
  };

  /** One lead with its full activity timeline (newest first). */
  const getLead = async (id: number) => {
    const [row] = await sql<LeadRow[]>`SELECT * FROM lead_cards WHERE id = ${id}`;
    if (!row) return null;
    const activities = await sql<ActivityRow[]>`
      SELECT la.id, la.kind, la.body, a.email AS admin_email, la.created_at
      FROM lead_activities la LEFT JOIN admins a ON a.id = la.admin_id
      WHERE la.lead_id = ${id} ORDER BY la.id DESC`;
    return {
      ...toLead(row),
      activities: activities.map((a) => ({
        id: a.id,
        kind: a.kind,
        body: a.body,
        by: a.admin_email,
        at: new Date(a.created_at).toISOString(),
      })),
    };
  };

  return {
    /** Every inquiry becomes a lead in "New" — in the same transaction, so there's never one without the other. */
    createInquiry(i: { name: string; email: string; company: string | null; service: string; budget: string; message: string }) {
      return sql.begin(async (tx) => {
        const [row] = await tx<{ id: number }[]>`
          INSERT INTO inquiries (name, email, company, service, budget, message)
          VALUES (${i.name}, ${i.email}, ${i.company}, ${i.service}, ${i.budget}, ${i.message})
          RETURNING id`;
        const [lead] = await tx<{ id: number }[]>`INSERT INTO leads (inquiry_id) VALUES (${row!.id}) RETURNING id`;
        await tx`INSERT INTO lead_activities (lead_id, kind, body) VALUES (${lead!.id}, 'created', 'Inquiry received via Let''s talk')`;
        return row!.id;
      });
    },
    listInquiries: () => sql`SELECT * FROM inquiries ORDER BY id DESC LIMIT 500`,

    listAdmins: () => sql<{ id: number; email: string }[]>`SELECT id, email FROM admins ORDER BY email`,

    async listLeads() {
      const rows = await sql<LeadRow[]>`SELECT * FROM lead_cards ORDER BY updated_at DESC, id DESC LIMIT 1000`;
      return rows.map(toLead);
    },
    getLead,

    /** Locks the lead row so concurrent edits apply one after the other and each logs the right "from" value. */
    async updateLead(id: number, patch: LeadPatch, adminId: number) {
      await sql.begin(async (tx) => {
        const [row] = await tx<LeadRow[]>`
          SELECT id, stage, deal_value, owner_id, follow_up_on::text AS follow_up_on, lost_reason FROM leads WHERE id = ${id} FOR UPDATE`;
        if (!row) throw new NotFoundError("Lead not found");
        let ownerEmail: string | null = null;
        if (patch.ownerId != null) {
          const [owner] = await tx<{ email: string }[]>`SELECT email FROM admins WHERE id = ${patch.ownerId}`;
          if (!owner) throw new LeadValidationError({ ownerId: "Unknown owner" });
          ownerEmail = owner.email;
        }
        const current = { stage: row.stage, dealValue: row.deal_value, ownerId: row.owner_id, followUpOn: row.follow_up_on, lostReason: row.lost_reason };
        const { next, activities } = applyLeadPatch(current, patch, ownerEmail);
        if (!activities.length) return;
        await tx`
          UPDATE leads SET stage = ${next.stage}, deal_value = ${next.dealValue}, owner_id = ${next.ownerId},
            follow_up_on = ${next.followUpOn}, lost_reason = ${next.lostReason}, updated_at = now()
          WHERE id = ${id}`;
        for (const a of activities) {
          await tx`INSERT INTO lead_activities (lead_id, admin_id, kind, body) VALUES (${id}, ${adminId}, ${a.kind}, ${a.body})`;
        }
      });
      return (await getLead(id))!;
    },

    async addLeadNote(id: number, body: string, adminId: number) {
      const [row] = await sql<{ id: number }[]>`
        INSERT INTO lead_activities (lead_id, admin_id, kind, body)
        SELECT ${id}, ${adminId}, 'note', ${body} WHERE EXISTS (SELECT 1 FROM leads WHERE id = ${id})
        RETURNING id`;
      if (!row) throw new NotFoundError("Lead not found");
      await sql`UPDATE leads SET updated_at = now() WHERE id = ${id}`;
      return (await getLead(id))!;
    },

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
