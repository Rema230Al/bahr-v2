# Bahr — concept redesign of bybahr.com

Scroll is a dive: Surface → Sunlight → Twilight → Midnight → Abyss. Public site + inquiry form, careers board, admin dashboard. Copy is bilingual (EN + AR, RTL) in `web/src/i18n/content.ts`. Details: `README.md`.

## Structure & stack
- `api/` — Bun + Elysia + PostgreSQL (Bun.SQL, SQL files in `migrations/`). Security in `src/security/`, business rules in `src/domain/`. Deployed via Docker to Fly.io, DB on Neon. Local dev uses PGlite (`scripts/dev-local.ts`).
- `web/` — Vite + React 19 + TS, Tailwind v4, GSAP/ScrollTrigger (`lib/gsap.ts`), Lenis, R3F/three, Framer Motion. Deployed to Cloudflare Workers Static Assets (`worker/`, `wrangler.jsonc`).
- `e2e/` — Playwright; starts its own API + web (ports 3100/5180) on a throwaway DB.

## Commands
```bash
cd api && bun run dev          # :3000 (needs api/.env from .env.example)
cd web && bun run dev          # :5173, proxies /api → :3000
cd api && bun test && bun run typecheck
cd web && bun run build && bun run lint
cd e2e && npx playwright test --project=e2e --project=e2e-mobile
cd e2e && npx playwright test --project=screens     # screenshots → e2e/screens/
# Deploy
cd api && fly deploy --ha=false
cd web && bun run build && npx wrangler deploy
```

## Design system (reuse — never invent new tokens)
All tokens live in `web/src/index.css` (`@theme` + `:root` / `[data-theme="dark"]`).
- **Colors** (use Tailwind names `bg`, `ink`, `muted`, `line`, `accent`, `signal`, `sea`, or the CSS vars):
  light `--bg #e6e6df`, `--ink #242423`, `--muted #646460`, `--accent/--signal #0e61ad`, `--line` ink @16%, `--field` ink @4%.
  dark `--bg #101d30`, `--ink #dfe6ee`, `--muted #9aa9bb`, `--accent #6aa8ea`, `--signal #8ec0ff`.
- **Fonts**: `font-display` Inter Tight, `font-mono` JetBrains Mono, IBM Plex Sans Arabic for AR (loaded in `index.html`).
- **Type scale**: `--fs-mega`, `--fs-huge`, `--fs-xl`, `--fs-lg`, `--fs-md`, `--fs-label` (all fluid `clamp`). Classes `.display` (uppercase, tight) and `.label` (mono, 0.18em tracking, uppercase).
- **Spacing**: page side padding `--gutter` (`clamp(1rem, 4.5vw, 4rem)`); otherwise Tailwind spacing.
- **Shape**: hairline 1px `border-line`, radius 2px on fields; pill buttons (`rounded-full`, mono 11px uppercase).
- **Utility classes**: `.field` (inputs/selects), `.link-underline`, `.track-hover`, `.mask`/`.mask-inner`, `.glow`, `.sr-only`.
- **Shared components** (`web/src/components/ui/`): `Nav`, `Logo`, `Field`, `Magnetic` (primary button), `SplitWords`, `SeaWaves`, `Grain`, `Cursor`, `SmoothScroll`, `ErrorBoundary`. Hooks in `lib/hooks.ts` (`useReducedMotion`, `useIsMobile`, `useInViewport`, `useIdle`); API client in `lib/api.ts`; prefs/theme/lang in `i18n/PrefsProvider.tsx`.
- **Motion**: single easing `--ease-out-expo` = `cubic-bezier(0.16, 1, 0.3, 1)` (Framer: `ease: [0.16, 1, 0.3, 1]`; GSAP: `power3.out`). Durations ~0.3–0.7s for UI. Public pages use GSAP ScrollTrigger + Lenis for scroll-driven effects and split-word mask reveals. Always respect `prefers-reduced-motion` (CSS block + `useReducedMotion`).
- Arabic: never letter-space or uppercase; every string needs EN + AR; use logical props (`ms-`, `inset-inline`, `text-start`) so RTL works.

## Admin pages
Same brand (tokens, fonts, components) but calm and functional. No scroll-driven/GSAP animations or heavy effects. Only subtle Framer Motion: fade/slide-in of ~16px, `layoutId` tab indicator, `AnimatePresence` for swaps (see `pages/Admin.tsx`). `SeaWaves` as a slow background is the only ambient motion.

## Working rules
- Simplest correct solution; reuse existing code, components, and tokens before adding anything new.
- After every change run all tests: `api` bun test + typecheck, `web` build + lint, e2e Playwright.
- Commit to git after each working change.
