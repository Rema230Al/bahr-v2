# Bahr — "Design with depth" (concept redesign)

A full-stack concept redesign of [bybahr.com](https://bybahr.com). Scrolling is a dive from the sea surface to the abyss:
**Surface 0 m → Sunlight 200 m (The Agency) → Twilight 1,000 m (Expertise) → Midnight 4,000 m (Selected work) → Abyss 6,000 m (Let's dive deeper)**.
It includes a project-inquiry form, a careers board with applications, and an admin dashboard.

```
api/   Elysia + Bun + SQLite (bun:sqlite)   → Docker → Fly.io
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
cd api && bun test            # 43 tests: unit + API + integration
cd e2e && npm install && npx playwright install chromium
npx playwright test --project=e2e --project=e2e-mobile   # E2E flows, desktop + 390px phone
npx playwright test --project=screens                    # screenshots → e2e/screens/
```

| Layer | File | Covers |
|---|---|---|
| Unit | `api/test/opening.unit.test.ts` | An opening moves open → closed; it can't close twice |
| API | `api/test/api.test.ts` | Validation (types, lengths, email, `https?://` only, trimming, unknown fields stripped, bad JSON), honeypot, duplicate applications (case-insensitive), every admin route 401 without or with a forged session, cookie flags, logout, CSRF origin check, rate limits (forms + login, per IP, invalid attempts count), CORS, security headers |
| Integration | `api/test/integration.test.ts` | Data is saved and normalized; data survives a restart; accepting closes the opening and marks the others "not selected"; two simultaneous accepts, only one wins; the DB rejects a second accepted row; cross-opening accept is refused |
| E2E | `e2e/tests/flows.spec.ts` | Send an inquiry → apply (and a duplicate is refused) → admin logs in (a wrong password fails first), sees the inquiry, accepts → the public board shows "Filled" |

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

## Deploy (not done yet)

**API → Fly.io**
```bash
cd api
fly launch --no-deploy --copy-config        # uses fly.toml + Dockerfile
fly volumes create bahr_data --size 1
fly secrets set ALLOWED_ORIGIN=https://your-domain ADMIN_EMAIL=… ADMIN_PASSWORD=… PROXY_SECRET=$(openssl rand -hex 32)
fly deploy
```
The API is designed for a single machine, because SQLite and the in-memory rate limiter live on one instance. To scale out, move to Postgres/LiteFS and Redis.

**Web → Cloudflare**
```bash
cd web
# set API_ORIGIN in wrangler.jsonc to your Fly URL
npx wrangler secret put PROXY_SECRET        # same value as on Fly
bun run build && npx wrangler deploy
```

## Content

The copy (EN + AR) comes from bybahr.com. The zone facts are standard oceanography (sunlight zone to ~200 m, no sunlight in the midnight zone, ~2 °C in the abyss). The logo is typeset "بحر" in Aref Ruqaa, standing in for their real calligraphy mark.
