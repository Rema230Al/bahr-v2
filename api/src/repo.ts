import type { Db } from "./db";
import { acceptApplicant, canApply, OpeningClosedError, type Opening, type OpeningKind } from "./domain/opening";

type OpeningRow = {
  id: number;
  title: string;
  kind: OpeningKind;
  location: string;
  description: string;
  status: "open" | "closed";
  accepted_application_id: number | null;
  created_at: string;
  closed_at: string | null;
};

const toOpening = (r: OpeningRow): Opening => ({
  id: r.id,
  title: r.title,
  kind: r.kind,
  location: r.location,
  description: r.description,
  status: r.status,
  acceptedApplicationId: r.accepted_application_id,
  createdAt: r.created_at,
  closedAt: r.closed_at,
});

export class NotFoundError extends Error {}
export class DuplicateApplicationError extends Error {}

const isUniqueViolation = (e: unknown) =>
  e instanceof Error && /UNIQUE constraint failed/i.test(e.message);

export function createRepo(db: Db) {
  const q = {
    insertInquiry: db.query(
      `INSERT INTO inquiries (name, email, company, service, budget, message)
       VALUES ($name, $email, $company, $service, $budget, $message) RETURNING id`,
    ),
    listInquiries: db.query(`SELECT * FROM inquiries ORDER BY id DESC LIMIT 500`),
    insertOpening: db.query(
      `INSERT INTO openings (title, kind, location, description)
       VALUES ($title, $kind, $location, $description) RETURNING *`,
    ),
    getOpening: db.query(`SELECT * FROM openings WHERE id = ?`),
    listOpenings: db.query(`SELECT * FROM openings ORDER BY status = 'closed', id DESC`),
    listOpeningsWithCounts: db.query(
      `SELECT o.*, (SELECT COUNT(*) FROM applications a WHERE a.opening_id = o.id) AS applicants
       FROM openings o ORDER BY o.status = 'closed', o.id DESC`,
    ),
    closeOpening: db.query(
      `UPDATE openings SET status = 'closed', accepted_application_id = $applicationId, closed_at = $closedAt
       WHERE id = $id AND status = 'open'`,
    ),
    insertApplication: db.query(
      `INSERT INTO applications (opening_id, name, email, portfolio, message)
       VALUES ($openingId, $name, $email, $portfolio, $message) RETURNING id`,
    ),
    getApplication: db.query(`SELECT * FROM applications WHERE id = ? AND opening_id = ?`),
    listApplications: db.query(`SELECT * FROM applications WHERE opening_id = ? ORDER BY id ASC`),
    acceptApplication: db.query(`UPDATE applications SET status = 'accepted' WHERE id = ? AND status = 'pending'`),
    declineOthers: db.query(
      `UPDATE applications SET status = 'not_selected' WHERE opening_id = ? AND id != ? AND status = 'pending'`,
    ),
  };

  const getOpening = (id: number) => {
    const row = q.getOpening.get(id) as OpeningRow | null;
    return row ? toOpening(row) : null;
  };

  return {
    createInquiry(i: { name: string; email: string; company: string | null; service: string; budget: string; message: string }) {
      return (q.insertInquiry.get(i) as { id: number }).id;
    },
    listInquiries: () => q.listInquiries.all(),

    createOpening(o: { title: string; kind: OpeningKind; location: string; description: string }) {
      return toOpening(q.insertOpening.get(o) as OpeningRow);
    },
    getOpening,
    listOpenings: () => (q.listOpenings.all() as OpeningRow[]).map(toOpening),
    listOpeningsWithCounts: () =>
      (q.listOpeningsWithCounts.all() as (OpeningRow & { applicants: number })[]).map((r) => ({
        ...toOpening(r),
        applicants: r.applicants,
      })),

    apply(openingId: number, a: { name: string; email: string; portfolio: string; message: string }) {
      const opening = getOpening(openingId);
      if (!opening) throw new NotFoundError("Opening not found");
      if (!canApply(opening)) throw new OpeningClosedError();
      try {
        return (q.insertApplication.get({ openingId, ...a }) as { id: number }).id;
      } catch (e) {
        if (isUniqueViolation(e)) throw new DuplicateApplicationError("Already applied");
        throw e;
      }
    },
    listApplications: (openingId: number) => q.listApplications.all(openingId),

    /**
     * Accepts one applicant and closes the opening, atomically. An IMMEDIATE transaction takes the
     * write lock up front so two concurrent accepts serialize; the partial unique index is the backstop.
     */
    accept: db
      .transaction((openingId: number, applicationId: number): Opening => {
        const opening = getOpening(openingId);
        if (!opening) throw new NotFoundError("Opening not found");
        const closed = acceptApplicant(opening, applicationId); // throws if already closed
        if (!q.getApplication.get(applicationId, openingId)) throw new NotFoundError("Applicant not found");
        try {
          if (q.acceptApplication.run(applicationId).changes !== 1) throw new OpeningClosedError();
        } catch (e) {
          if (isUniqueViolation(e)) throw new OpeningClosedError();
          throw e;
        }
        q.declineOthers.run(openingId, applicationId);
        const res = q.closeOpening.run({ id: openingId, applicationId, closedAt: closed.closedAt });
        if (res.changes !== 1) throw new OpeningClosedError();
        return closed;
      })
      .immediate,
  };
}

export type Repo = ReturnType<typeof createRepo>;
