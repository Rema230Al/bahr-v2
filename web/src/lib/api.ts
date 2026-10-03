/** Thin fetch wrapper. Same-origin /api by default (Vite proxy in dev, Cloudflare Worker in prod). */
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "/api";

export class ApiError extends Error {
  status: number;
  code: string;
  fields: Record<string, string>;
  constructor(status: number, code: string, fields: Record<string, string> = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "network");
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(res.status, String(data.error ?? "generic"), (data.fields as Record<string, string>) ?? {});
  }
  return data as T;
}

export type PublicOpening = {
  id: number;
  title: string;
  kind: "job" | "internship";
  location: string;
  description: string;
  status: "open" | "closed";
  createdAt: string;
  closedAt: string | null;
};
export type AdminOpening = PublicOpening & { acceptedApplicationId: number | null; applicants: number };
export type Inquiry = {
  id: number;
  name: string;
  email: string;
  company: string | null;
  service: string;
  budget: string;
  message: string;
  ai_brief: string | null;
  created_at: string;
};
export type Application = {
  id: number;
  opening_id: number;
  name: string;
  email: string;
  portfolio: string;
  message: string;
  status: "pending" | "accepted" | "not_selected";
  created_at: string;
};

export type Stage = "new" | "contacted" | "proposal" | "won" | "lost";
export const STAGES: [Stage, string][] = [
  ["new", "New"],
  ["contacted", "Contacted"],
  ["proposal", "Proposal sent"],
  ["won", "Won"],
  ["lost", "Lost"],
];
export type Lead = {
  id: number;
  inquiryId: number;
  stage: Stage;
  dealValue: number | null;
  ownerId: number | null;
  ownerEmail: string | null;
  followUpOn: string | null;
  lostReason: string | null;
  createdAt: string;
  updatedAt: string;
  name: string;
  email: string;
  company: string | null;
  service: string;
  budget: string;
  message: string;
  aiBrief: string | null;
};
export type LeadDetail = Lead & { activities: { id: number; kind: string; body: string; by: string | null; at: string }[] };
export type LeadPatch = Partial<Pick<Lead, "stage" | "dealValue" | "ownerId" | "followUpOn">> & { lostReason?: string };

/** Inclusive YYYY-MM-DD bounds for the admin lists; "" leaves that end open. */
export type DateRange = { from: string; to: string };
const rangeQuery = (r?: DateRange) => {
  const q = new URLSearchParams();
  if (r?.from) q.set("from", r.from);
  if (r?.to) q.set("to", r.to);
  return q.size ? `?${q}` : "";
};

export const api = {
  sendInquiry: (b: Record<string, string>) => request<{ ok: true }>("POST", "/inquiries", b),
  brief: (b: { lang: "en" | "ar"; idea: string; audience: string; features: string }) =>
    request<{ brief: string; demo: boolean }>("POST", "/assistant/brief", b),
  openings: () => request<PublicOpening[]>("GET", "/openings"),
  apply: (id: number, b: Record<string, string>) => request<{ ok: true }>("POST", `/openings/${id}/applications`, b),
  login: (email: string, password: string) => request<{ ok: true }>("POST", "/auth/login", { email, password }),
  logout: () => request<{ ok: true }>("POST", "/auth/logout"),
  me: () => request<{ email: string }>("GET", "/admin/me"),
  inquiries: (r?: DateRange) => request<Inquiry[]>("GET", `/admin/inquiries${rangeQuery(r)}`),
  adminOpenings: () => request<AdminOpening[]>("GET", "/admin/openings"),
  createOpening: (b: { title: string; kind: string; location: string; description: string }) =>
    request<AdminOpening>("POST", "/admin/openings", b),
  applications: (id: number, r?: DateRange) =>
    request<Application[]>("GET", `/admin/openings/${id}/applications${rangeQuery(r)}`),
  accept: (openingId: number, applicationId: number) =>
    request<AdminOpening>("POST", `/admin/openings/${openingId}/applications/${applicationId}/accept`),
  admins: () => request<{ id: number; email: string }[]>("GET", "/admin/admins"),
  leads: (r?: DateRange) => request<Lead[]>("GET", `/admin/leads${rangeQuery(r)}`),
  lead: (id: number) => request<LeadDetail>("GET", `/admin/leads/${id}`),
  updateLead: (id: number, b: LeadPatch) => request<LeadDetail>("PATCH", `/admin/leads/${id}`, b),
  addLeadNote: (id: number, body: string) => request<LeadDetail>("POST", `/admin/leads/${id}/notes`, { body }),
};
