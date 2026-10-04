# Bahr — "Design with depth"

A full-stack concept redesign of [bybahr.com](https://bybahr.com). Scrolling is a dive from the sea surface to the abyss, with each section at a different depth.

**Live:** https://bahr-web.remasalsulami.workers.dev

## Features
- **Cinematic dive journey:** GSAP ScrollTrigger, a 3D underwater scene (React Three Fiber), and a live depth counter
- **Project inquiry form** with an optional **AI assistant** that helps clients shape their idea into a project brief
- **Careers (jobs and internships):** Bahr posts job and internship openings, visitors apply, the same person can't apply twice, and the admin accepts one applicant, then the opening closes
- **Admin dashboard:** Leads CRM (New → Contacted → Proposal sent → Won / Lost), inquiries, openings, date range and search filters
- **Arabic (RTL) and English**, light and dark mode

## Stack
| Part | Tech | Hosting |
|---|---|---|
| Frontend | Vite, React, TypeScript, GSAP, Framer Motion, R3F | Cloudflare Workers |
| Backend | Bun, Elysia, Docker | Fly.io |
| Database | PostgreSQL with SQL migrations | Neon |
| Tests | bun test, Playwright | |

## Security
- Hashed passwords (argon2id) and secure httpOnly session cookies
- Server-side permission checks on every admin route, plus CSRF origin checks
- Input validation on every request, and rules enforced in the database
- Rate limits on forms, login, and the AI assistant, plus a daily AI cost cap
- AI: API key on the server only, prompt injection guard, briefs shown as plain text (no XSS)
- Strict CORS, security headers, and secrets only in environment variables

## Run locally
Needs [Bun](https://bun.sh) and Node 20+.
```bash
cd api && bun install && cp .env.example .env && bun run dev   # http://localhost:3000
cd web && bun install && bun run dev                            # http://localhost:5173
```
Admin: `/admin`, using `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `api/.env`.

## Tests
```bash
cd api && bun test            # unit, API, and integration
cd e2e && npm install && npx playwright test   # end-to-end, desktop and mobile
```

## Deploy
- **API:** `fly deploy` from `api/`, with secrets set by `fly secrets set`
- **Web:** `bun run build && npx wrangler deploy` from `web/`

The AI assistant runs in demo mode until `ANTHROPIC_API_KEY` is set.
