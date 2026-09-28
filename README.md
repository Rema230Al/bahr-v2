# Bahr — "Design with depth" (concept redesign)

A full-stack concept redesign of [bybahr.com](https://bybahr.com). Scrolling is a dive from the sea surface to the abyss:
**Surface 0 m → Sunlight 200 m (The Agency) → Twilight 1,000 m (Expertise) → Midnight 4,000 m (Selected work) → Abyss 6,000 m (Let's dive deeper)**.
It includes a project-inquiry form, a careers board with applications, and an admin dashboard with a Leads CRM.

```
api/   Elysia + Bun + PostgreSQL (Bun.SQL, SQL migrations)   → Docker → Fly.io, database on Neon
web/   Vite + React + TS, GSAP/ScrollTrigger, Lenis, R3F, Framer Motion → Cloudflare Workers Static Assets
e2e/   Playwright (starts its own API + web on ports 3100/5180 with a throwaway DB)
```

## Run it locally

Prereqs: [Bun](https://bun.sh) ≥ 1.4 (`npm i -g bun`) and Node ≥ 20.

```bash
# 1) API  (http://localhost:3000)
cd api
bun install
cp .env.example .env          # set ADMIN_EMAIL / ADMIN_PASSWORD (12+ chars)
bun run dev

# 2) Web  (http://localhost:5173) — in a second terminal
cd web
bun install
bun run dev                   # proxies /api → localhost:3000
```

- Site: http://localhost:5173
- Careers: http://localhost:5173/careers
- Admin: http://localhost:5173/admin. Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `api/.env`. The admin account is created on first boot.

## Tests

```bash
cd api && bun test            # 72 tests: unit + API + integration
cd e2e && npm install && npx playwright install chromium
npx playwright test --project=e2e --project=e2e-mobile   # E2E flows, desktop + 390px phone
npx playwright test --project=screens                    # screenshots → e2e/screens/
```

| Layer | File | Covers |
|---|---|---|
| Unit | `api/test/opening.unit.test.ts` | An opening moves open → closed; it can't close twice |
| API | `api/test/api.test.ts` | Validation (types, lengths, email, `https?://` only, trimming, unknown fields stripped, bad JSON), honeypot, duplicate applications (case-insensitive), every admin route 401 without or with a forged session, cookie flags, logout, CSRF origin check, rate limits (forms + login, per IP, invalid attempts count), CORS, security headers |
| Integration | `api/test/integration.test.ts` | Data is saved and normalized; data survives a restart; accepting closes the opening and marks the others "not selected"; two simultaneous accepts, only one wins; the DB rejects a second accepted row; cross-opening accept is refused |
| API | `api/test/leads.test.ts` | Each inquiry becomes a lead in New (existing ones too, via migration 002); stage moves are logged; Lost needs a reason; deal value / owner / follow-up date validation; notes; 404s; CSRF |
| E2E | `e2e/tests/flows.spec.ts` | Send an inquiry → apply (and a duplicate is refused) → admin logs in (a wrong password fails first), sees the inquiry, accepts → the public board shows "Filled" |
| API | `api/test/date-range.test.ts` | `?from`/`?to` on inquiries, leads and applications: inclusive days in `ADMIN_TIME_ZONE` (checked one minute either side of each edge), open-ended ranges, impossible dates and "to" before "from" refused, admin-only |
| E2E | `e2e/tests/leads.spec.ts` | Admin drags a lead from New to Won; it stays there after a reload and the timeline records the move |
| E2E | `e2e/tests/date-filter.spec.ts` | Admin picks a past range (today's inquiry disappears, Leads counts drop to 0), "to" before "from" is flagged, the range is kept across tabs, "Today" brings it back, Clear resets (desktop + phone) |

## Security

- **Passwords**: argon2id via `Bun.password`. Unknown emails still run a verify, so response timing doesn't reveal which emails exist.
- **Sessions**: a 256-bit random token in an `httpOnly`, `Secure`, `SameSite=Strict`, `__Host-` cookie with an 8h expiry. The DB stores only its SHA-256. Logout deletes it server-side.
- **Authorization**: every `/admin/*` route goes through a single `resolve` guard on the server. Admin writes also require the request `Origin` to match `ALLOWED_ORIGIN`, as CSRF defense in depth.
- **Validation**: Elysia/TypeBox schemas on every body and param. Values are trimmed before validation; unknown fields are stripped; bodies are capped at 64 KB.
- **Data rules in the DB**: `UNIQUE(opening_id, email)`, plus a partial unique index allowing one `accepted` row per opening. Accepting runs in an `IMMEDIATE` transaction.
- **Spam**: a honeypot field (bots get a fake 201 and nothing is saved). Rate limits: forms 5 per 10 min per IP; login 5 per 15 min per IP.
- **CORS**: only `ALLOWED_ORIGIN`, with credentials. **Headers**: strict CSP, HSTS, `X-Frame-Options: DENY`, nosniff, Referrer-Policy, Permissions-Policy. On the API these are set in `security/headers.ts`; on the site, in `web/public/_headers`.
- **Secrets** live only in env vars: `api/.env.example`, `web/.env.example`, Fly secrets, and `wrangler secret`.
- **Client IP for rate limiting**: the API trusts `x-client-ip` only when it arrives with the Worker's `PROXY_SECRET`.

## Architecture notes

- **The journey** (`web/src/components/sections/Dive.tsx`) is one pinned, scrubbed ScrollTrigger timeline. `web/src/lib/journey.ts` holds the timing, depth and color math shared by the timeline and the 3D scene. A mutable store (`lib/store.ts`) feeds `useFrame` without React re-renders, the same pattern as SOL.
- **A unique transition per stop**:
  - Surface: the title lifts away as the sea rises over the page.
  - Sunlight: words fall in like light from above.
  - Twilight: the section drifts up into focus, ending in a blackout.
  - Midnight: projects flicker on like bioluminescence.
  - Abyss: the line tightens its letter-spacing out of the dark (in Arabic, a scale-and-blur instead, since connected script can't be letter-spaced).
- **3D** (`components/three/`): custom shaders for the caustic surface seen from below, god rays, drifting marine snow, and bioluminescent points in Bahr blues. It's lazy-loaded after first idle (`DiveCanvas` is its own ~244 kB gz chunk). The canvas is transparent: the DOM carries the water color, so distance fade reads as underwater fog.
- **Hero** (`Dive.tsx` + `components/hero/`): Bahr's own composition, with the calligraphic mark centred and "A deeper / Creative / Approach" around it (one coral letter, drawn as a clipped overlay so Arabic stays joined). Behind it is a WebGL2 contour map of a drifting height field that ripples from the cursor (~30fps, paused once you've dived). On scroll the words move at different speeds, and the mark's vertical stroke stretches down and becomes the fixed **dive line** carrying the depth counter for the rest of the page.
- **Agency**: the mark in outline fills with rising water (an SVG clip path with a looping wave) as the section arrives.
- **Colours**: beige surface → blue → navy → very dark navy (`#0a1628`) at the abyss. Only beige, blues, navy and white; accents come from the blue logo.
- **Performance**: Lenis `lerp 0.16`, scrub `0.3`, pinned distance 6 viewport heights (5 on phones); ~1,200 particles (400 on phones), DPR ≤ 1.5; colour/DOM writes only when a value changes; no blur or SVG filters during scroll.
- **Phones**: DPR 1, fewer particles, and CSS rays instead of the ray shader. **Reduced motion**: no Lenis, no pin, no 3D, no cursor; the zones become stacked static sections. If WebGL fails, an error boundary drops the 3D scene and the site keeps working.
- **Same-origin API**: in dev, Vite proxies `/api`; in prod, the Worker (`web/worker/index.ts`) proxies `/api/*` to Fly. That keeps the session cookie first-party, so `SameSite=Strict` works.

## Database

PostgreSQL. Schema changes are numbered SQL files in `api/migrations/`; every API boot applies the
ones not yet recorded in `schema_migrations` (inside one transaction, under an advisory lock).

- **Production:** Neon (hosted Postgres). `DATABASE_URL` is a Fly secret — use Neon's *direct* host (not `-pooler`).
- **Local dev / tests:** no Postgres install needed. `bun run dev` and `bun test` start PGlite — real
  PostgreSQL compiled to WebAssembly — in-process (dev data persists in `api/data/pglite`).
  `bun run dev:pg` runs the API against whatever `DATABASE_URL` is in `api/.env` instead.
- **Admin password:** set once via Fly secrets; rotate with `fly ssh console -C "bun scripts/set-admin.ts"`.

## Deploy

**API → Fly.io** (Frankfurt, one small machine that sleeps when idle)
```bash
cd api
fly launch --no-deploy --copy-config --name bahr-api
fly secrets set DATABASE_URL=… SESSION_SECRET=… ADMIN_EMAIL=… ADMIN_PASSWORD=… PROXY_SECRET=… ALLOWED_ORIGIN=https://<live site>
fly deploy --ha=false
```
The in-memory rate limiter is per machine; with more machines, move it to Redis.

**Web → Cloudflare Workers (Static Assets)**
```bash
cd web
# wrangler.jsonc → vars.API_ORIGIN = https://bahr-api.fly.dev
npx wrangler secret put PROXY_SECRET        # same value as on Fly
bun run build && npx wrangler deploy
```

**Test the live site**
```bash
cd e2e
LIVE_URL=https://<live site> LIVE_ADMIN_EMAIL=… LIVE_ADMIN_PASSWORD=… npx playwright test
cd ../api && fly ssh console -C "bun scripts/cleanup-e2e.ts"   # remove the test records
```

## Content

The copy (EN + AR) comes from bybahr.com. The zone facts are standard oceanography (sunlight zone to ~200 m, no sunlight in the midnight zone, ~2 °C in the abyss). The logo is typeset "بحر" in Aref Ruqaa, standing in for their real calligraphy mark.
