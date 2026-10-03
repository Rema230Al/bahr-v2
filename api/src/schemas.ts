import { t } from "elysia";
import { isIsoDate, STAGES } from "./domain/lead";

/** Hidden field real people never see or fill. Bots that do get a fake success. */
const honeypot = t.Optional(t.String({ maxLength: 500 }));

const email = t.String({ format: "email", maxLength: 254 });

export const SERVICES = ["web", "ai", "mobile", "other"] as const;
export const AI_BRIEF_MAX = 2000;
export const BUDGETS =["under-50k", "50k-150k", "150k-500k", "500k-plus", "not-sure"] as const;

export const inquiryBody = t.Object(
  {
    name: t.String({ minLength: 2, maxLength: 100 }),
    email,
    company: t.Optional(t.String({ maxLength: 120 })),
    service: t.UnionEnum(SERVICES),
    budget: t.UnionEnum(BUDGETS),
    message: t.String({ minLength: 10, maxLength: 4000 }),
    /** The assistant's brief, as edited by the client. Stored and shown as plain text only. */
    aiBrief: t.Optional(t.String({ maxLength: AI_BRIEF_MAX })),
    website: honeypot,
  },
  { additionalProperties: false },
);

/** "Help me shape my idea": three short answers, capped so a request can't get expensive. */
export const briefBody = t.Object(
  {
    lang: t.UnionEnum(["en", "ar"]),
    idea: t.String({ minLength: 10, maxLength: 600 }),
    audience: t.Optional(t.String({ maxLength: 300 })),
    features: t.Optional(t.String({ maxLength: 600 })),
  },
  { additionalProperties: false },
);

export const applicationBody = t.Object(
  {
    name: t.String({ minLength: 2, maxLength: 100 }),
    email,
    portfolio: t.String({ minLength: 8, maxLength: 500, pattern: "^https?://[^\\s]+$" }),
    message: t.String({ minLength: 10, maxLength: 3000 }),
    website: honeypot,
  },
  { additionalProperties: false },
);

export const loginBody = t.Object(
  {
    email: t.String({ maxLength: 254 }),
    password: t.String({ minLength: 1, maxLength: 200 }),
  },
  { additionalProperties: false },
);

export const openingBody = t.Object(
  {
    title: t.String({ minLength: 3, maxLength: 120 }),
    kind: t.UnionEnum(["job", "internship"]),
    location: t.String({ minLength: 2, maxLength: 80 }),
    description: t.String({ minLength: 20, maxLength: 5000 }),
  },
  { additionalProperties: false },
);

export const idParam = t.Object({ id: t.Integer({ minimum: 1 }) });
export const acceptParams = t.Object({ id: t.Integer({ minimum: 1 }), applicationId: t.Integer({ minimum: 1 }) });

/**
 * Schema lengths are checked on the raw input; this trims, collapses whitespace-only values
 * and re-checks minimums so "   " can't pass as a name.
 */
export function clean<T extends Record<string, unknown>>(body: T, mins: Partial<Record<keyof T, number>>) {
  const out: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) out[k] = typeof v === "string" ? v.trim() : v;
  for (const [k, min] of Object.entries(mins) as [string, number][]) {
    if (typeof out[k] !== "string" || (out[k] as string).length < min) errors[k] = `Must be at least ${min} characters`;
  }
  if (typeof out.email === "string") {
    out.email = out.email.toLowerCase();
    // Belt and braces on top of the schema format check.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(out.email as string)) errors.email = "Enter a valid email";
  }
  return { value: out as T, errors: Object.keys(errors).length ? errors : null };
}

export const leadPatchBody = t.Object(
  {
    stage: t.Optional(t.UnionEnum(STAGES)),
    dealValue: t.Optional(t.Nullable(t.Integer({ minimum: 0, maximum: 1_000_000_000 }))),
    ownerId: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))),
    followUpOn: t.Optional(t.Nullable(t.String({ pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" }))),
    lostReason: t.Optional(t.String({ maxLength: 500 })),
  },
  { additionalProperties: false },
);

export const noteBody = t.Object({ body: t.String({ minLength: 1, maxLength: 2000 }) }, { additionalProperties: false });

const DATE = "^[0-9]{4}-[0-9]{2}-[0-9]{2}$";

/** ?from=YYYY-MM-DD&to=YYYY-MM-DD — both optional, both inclusive calendar days. */
export const dateRangeQuery = t.Object(
  { from: t.Optional(t.String({ pattern: DATE })), to: t.Optional(t.String({ pattern: DATE })) },
  { additionalProperties: false },
);

/** Rejects impossible dates (2026-02-31) and a "to" before "from". */
export function checkRange(q: { from?: string; to?: string }) {
  const errors: Record<string, string> = {};
  if (q.from && !isIsoDate(q.from)) errors.from = "Enter a valid date";
  if (q.to && !isIsoDate(q.to)) errors.to = "Enter a valid date";
  if (!errors.from && !errors.to && q.from && q.to && q.to < q.from) errors.to = "\"To\" can't be before \"From\"";
  return { range: { from: q.from ?? null, to: q.to ?? null }, errors: Object.keys(errors).length ? errors : null };
}
