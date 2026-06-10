# Milestone 1 — Branded Read-Only Storefront

**Goal:** A tenant's menu renders at their domain with their theme, faithful to the Home Burger design (see `docs/design/storefront-spec.md` — the gold standard). Read-only: browsing, search, category nav. Cart/checkout = M2.

**Architecture:** Middleware rewrites tenant-host requests to `/store/*` routes. Store layout (server component) loads tenant+theme via DAL and injects design tokens as CSS variables. Menu page (server component) loads the full menu via DAL (explicit tenant scoping, service role) and renders a client `MenuView` (search, sticky category nav with scroll-spy, Wolt-style horizontal cards, RTL, Rubik).

## Tasks

1. **Middleware rewrite** — tenant hosts: rewrite `path` → `/store{path}`; root host: block direct `/store` access (404) and pass through. Headers `x-tenant-*` unchanged.
2. **Types + DAL** (`src/lib/types.ts`, `src/lib/dal/tenant-data.ts`) — `getTenantContext(tenantId)` (tenant+theme), `getFullMenu(tenantId)` (available categories→items→option_groups→options, sorted). Server-only. DAL test asserts tenant scoping using the two seeded tenants.
3. **Price util (TDD)** — `formatPrice(agorot)` → `"₪55.00"`; handles 0 and non-round values. Test first.
4. **Store layout** (`src/app/store/layout.tsx`) — theme CSS-var injection, Rubik via `next/font/google` (hebrew subset), RTL, header (logo/name, cart icon placeholder with 0 badge), footer with footer tokens, suspended-tenant gate ("סגור זמנית" page when status=suspended).
5. **Menu page + MenuView client** (`src/app/store/page.tsx`, `src/components/store/MenuView.tsx`) — per design spec §2-3: search bar, sticky category chips with scroll-spy + smooth scroll, category section headers (RTL accent border), item cards (horizontal, image side, price `var(--brand-primary)`, line-clamp-2 description, unavailable overlay, hover lift). Empty/skeleton states.
6. **Local verification** — dev server; curl demo-a + demo-b: each shows own items (המבורגר קלאסי vs מרגריטה), own theme vars in HTML; unknown host 404; root unaffected. `npm test` green.
7. **Deploy** — push → Vercel auto-build; verify READY state + root URL 200 via CLI.

## Acceptance
- demo-a.localtest.me:3000 renders the burger menu with theme tokens; demo-b renders pizza; zero cross-tenant leakage; tests green; Vercel production build READY.
