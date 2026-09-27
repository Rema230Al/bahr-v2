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

export const api = {
  sendInquiry: (b: Record<string, string>) => request<{ ok: true }>("POST", "/inquiries", b),
  openings: () => request<PublicOpening[]>("GET", "/openings"),
  apply: (id: number, b: Record<string, string>) => request<{ ok: true }>("POST", `/openings/${id}/applications`, b),
  login: (email: string, password: string) => request<{ ok: true }>("POST", "/auth/login", { email, password }),
  logout: () => request<{ ok: true }>("POST", "/auth/logout"),
  me: () => request<{ email: string }>("GET", "/admin/me"),
  inquiries: () => request<Inquiry[]>("GET", "/admin/inquiries"),
  adminOpenings: () => request<AdminOpening[]>("GET", "/admin/openings"),
  createOpening: (b: { title: string; kind: string; location: string; description: string }) =>
    request<AdminOpening>("POST", "/admin/openings", b),
  applications: (id: number) => request<Application[]>("GET", `/admin/openings/${id}/applications`),
  accept: (openingId: number, applicationId: number) =>
    request<AdminOpening>("POST", `/admin/openings/${openingId}/applications/${applicationId}/accept`),
};
