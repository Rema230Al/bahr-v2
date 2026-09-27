import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import type { Config } from "./config";
import type { Db } from "./db";
import { createRepo, DuplicateApplicationError, NotFoundError } from "./repo";
import { OpeningClosedError } from "./domain/opening";
import { createRateLimiter, RateLimitError } from "./security/rateLimit";
import { createSessions } from "./security/session";
import { createAdmins } from "./security/admins";
import { SECURITY_HEADERS } from "./security/headers";
import {
  acceptParams,
  applicationBody,
  clean,
  idParam,
  inquiryBody,
  loginBody,
  openingBody,
} from "./schemas";

class HttpError extends Error {
  constructor(
    public status: number,
    public body: Record<string, unknown>,
  ) {
    super(String(body.error));
  }
}

const invalid = (fields: Record<string, string>) => new HttpError(400, { error: "validation", fields });

export function createApp(config: Config, db: Db) {
  const repo = createRepo(db);
  const sessions = createSessions(db, config.sessionTtlHours);
  const admins = createAdmins(db);
  const formLimiter = createRateLimiter(config.rateLimit.formMax, config.rateLimit.formWindowMs);
  const loginLimiter = createRateLimiter(config.rateLimit.loginMax, config.rateLimit.loginWindowMs);
  const cookieName = config.cookieSecure ? "__Host-bahr_session" : "bahr_session";

  /** Client IP: only trust forwarding headers set by a proxy we control. */
  const clientIp = (request: Request, server: { requestIP(r: Request): { address: string } | null } | null) => {
    const h = request.headers;
    if (config.proxySecret && h.get("x-proxy-secret") === config.proxySecret) {
      const ip = h.get("x-client-ip");
      if (ip) return ip;
    }
    if (config.ipHeader) {
      const ip = h.get(config.ipHeader)?.split(",")[0]?.trim();
      if (ip) return ip;
    }
    return server?.requestIP(request)?.address ?? "unknown";
  };

  /** CSRF defence in depth (on top of SameSite=Strict): state-changing requests must come from our origin. */
  const assertSameOrigin = (request: Request) => {
    const origin = request.headers.get("origin");
    if (origin && origin !== config.allowedOrigin) throw new HttpError(403, { error: "forbidden_origin" });
    if (!origin && request.headers.get("sec-fetch-site") === "cross-site") {
      throw new HttpError(403, { error: "forbidden_origin" });
    }
  };

  const publicRoutes = new Elysia()
    .get("/health", () => ({ ok: true }))
    .get("/openings", () =>
      repo.listOpenings().map(({ acceptedApplicationId: _hidden, ...o }) => o),
    )
    .get(
      "/openings/:id",
      ({ params }) => {
        const o = repo.getOpening(params.id);
        if (!o) throw new HttpError(404, { error: "not_found" });
        const { acceptedApplicationId: _hidden, ...rest } = o;
        return rest;
      },
      { params: idParam },
    )
    .post(
      "/inquiries",
      ({ body, set }) => {
        if (body.website) return fakeSuccess(set);
        const { value, errors } = clean(body, { name: 2, message: 10 });
        if (errors) throw invalid(errors);
        const id = repo.createInquiry({ ...value, company: value.company || null });
        set.status = 201;
        return { ok: true, id };
      },
      {
        body: inquiryBody,
        transform: ({ request, server, body }) => {
          formLimiter.hit(`inquiry:${clientIp(request, server)}`);
          trimStrings(body);
        },
      },
    )
    .post(
      "/openings/:id/applications",
      ({ body, params, set }) => {
        if (body.website) return fakeSuccess(set);
        const { value, errors } = clean(body, { name: 2, message: 10 });
        if (errors) throw invalid(errors);
        const { website: _hp, ...application } = value;
        const id = repo.apply(params.id, application);
        set.status = 201;
        return { ok: true, id };
      },
      {
        params: idParam,
        body: applicationBody,
        transform: ({ request, server, body }) => {
          formLimiter.hit(`apply:${clientIp(request, server)}`);
          trimStrings(body);
        },
      },
    );

  const authRoutes = new Elysia({ prefix: "/auth" })
    .post(
      "/login",
      async ({ body, cookie, request, server }) => {
        assertSameOrigin(request);
        const admin = await admins.authenticate(body.email, body.password);
        if (!admin) throw new HttpError(401, { error: "invalid_credentials" });
        cookie[cookieName]!.set({
          value: sessions.create(admin.id),
          httpOnly: true,
          secure: config.cookieSecure,
          sameSite: "strict",
          path: "/",
          maxAge: sessions.maxAgeSec,
        });
        return { ok: true, admin: { email: admin.email } };
      },
      {
        body: loginBody,
        transform: ({ request, server }) => loginLimiter.hit(`login:${clientIp(request, server)}`),
      },
    )
    .post("/logout", ({ cookie, request }) => {
      assertSameOrigin(request);
      const c = cookie[cookieName]!;
      sessions.destroy(c.value as string | undefined);
      c.set({ value: "", httpOnly: true, secure: config.cookieSecure, sameSite: "strict", path: "/", maxAge: 0 });
      return { ok: true };
    });

  /** Every route in here passes the server-side admin check first — no exceptions. */
  const adminRoutes = new Elysia({ prefix: "/admin" })
    .resolve(({ cookie, request }) => {
      const admin = sessions.verify(cookie[cookieName]?.value as string | undefined);
      if (!admin) throw new HttpError(401, { error: "unauthorized" });
      if (admin.role !== "admin") throw new HttpError(403, { error: "forbidden" });
      if (request.method !== "GET") assertSameOrigin(request);
      return { admin };
    })
    .get("/me", ({ admin }) => ({ email: admin.email }))
    .get("/inquiries", () => repo.listInquiries())
    .get("/openings", () => repo.listOpeningsWithCounts())
    .post(
      "/openings",
      ({ body, set }) => {
        const { value, errors } = clean(body, { title: 3, location: 2, description: 20 });
        if (errors) throw invalid(errors);
        set.status = 201;
        return repo.createOpening(value);
      },
      { body: openingBody, transform: ({ body }) => trimStrings(body) },
    )
    .get(
      "/openings/:id/applications",
      ({ params }) => {
        if (!repo.getOpening(params.id)) throw new HttpError(404, { error: "not_found" });
        return repo.listApplications(params.id);
      },
      { params: idParam },
    )
    .post(
      "/openings/:id/applications/:applicationId/accept",
      ({ params }) => repo.accept(params.id, params.applicationId),
      { params: acceptParams },
    );

  return new Elysia({ serve: { maxRequestBodySize: 64 * 1024 } })
    .use(
      cors({
        origin: config.allowedOrigin,
        credentials: true,
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Content-Type"],
        maxAge: 600,
      }),
    )
    .onRequest(({ set }) => {
      Object.assign(set.headers, SECURITY_HEADERS);
    })
    .error({ HttpError, RateLimitError, NotFoundError, DuplicateApplicationError, OpeningClosedError })
    .onError(({ code, error, set }) => {
      Object.assign(set.headers, SECURITY_HEADERS);
      switch (code) {
        case "HttpError":
          set.status = error.status;
          return error.body;
        case "RateLimitError":
          set.status = 429;
          set.headers["retry-after"] = String(error.retryAfterSec);
          return { error: "rate_limited", retryAfter: error.retryAfterSec };
        case "NotFoundError":
          set.status = 404;
          return { error: "not_found" };
        case "DuplicateApplicationError":
          set.status = 409;
          return { error: "already_applied" };
        case "OpeningClosedError":
          set.status = 409;
          return { error: "opening_closed" };
        case "VALIDATION": {
          set.status = 400;
          const fields: Record<string, string> = {};
          for (const e of error.all) {
            const path = "path" in e ? String(e.path).replace(/^\//, "") : "";
            if (path && !fields[path]) fields[path] = e.summary ?? e.message ?? "Invalid value";
          }
          return { error: "validation", fields };
        }
        case "PARSE":
          set.status = 400;
          return { error: "invalid_body" };
        case "NOT_FOUND":
          set.status = 404;
          return { error: "not_found" };
        default:
          console.error(error);
          set.status = 500;
          return { error: "server_error" };
      }
    })
    .use(publicRoutes)
    .use(authRoutes)
    .use(adminRoutes);
}

/** Runs before schema validation, so "  a@b.co " is validated as "a@b.co". */
function trimStrings(body: unknown) {
  if (!body || typeof body !== "object") return;
  const b = body as Record<string, unknown>;
  for (const k of Object.keys(b)) if (typeof b[k] === "string") b[k] = (b[k] as string).trim();
}

function fakeSuccess(set: { status?: number | string }) {
  set.status = 201;
  return { ok: true };
}
