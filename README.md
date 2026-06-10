# Platform (working name)

Multi-tenant restaurant-ordering SaaS. Spec + plans: `docs/` (spec maintained in the HBv1.0 repo until this repo becomes primary).

## Non-negotiable rules
1. **Tenant isolation:** every table has `tenant_id` + RLS. `npm run test:isolation` must pass before every merge.
2. **Money is integer agorot.** Never float. (5500 = ₪55.00)
3. **Theming is data.** No hardcoded colors/brand in components — design tokens only.
4. **Anon clients get nothing from PostgREST.** Storefront reads go through server-side code with explicit tenant scoping.
5. The HBv1.0 repo (`c:\Users\Adir\HBv1.0`) is read-only reference. Never modify it.

## Environment note (this machine)
Avast antivirus intercepts TLS. Node tooling needs its root cert:
`NODE_EXTRA_CA_CERTS=C:\Users\Adir\.certs\avast-root.pem` (set as user env var; new shells pick it up automatically).

## Setup
1. `npm install`
2. Copy `.env.local.example` → `.env.local`, fill from Supabase dashboard
3. `npx supabase link --project-ref <ref> --password <db password>`
4. `npx supabase db push --password <db password>`
5. `npm run seed`
6. `npm run dev` → http://demo-a.localtest.me:3000/api/debug/tenant

## Commands
- `npm test` — all tests
- `npm run test:isolation` — tenant isolation suite (the iron rule)
- `npm run seed` — idempotent demo data (demo-a burgers, demo-b pizza + staff logins)
- `npx supabase db push` — apply new migrations

## Structure
- `supabase/migrations/` — schema (SQL, numbered)
- `src/lib/tenant/` — host parsing + tenant resolution
- `src/middleware.ts` — domain → tenant (`x-tenant-id` request headers)
- `src/app/api/debug/tenant/` — dev-only resolution check
- `tests/isolation/` — cross-tenant access tests
- `scripts/seed-demo.ts` — demo data
- `spikes/` — throwaway research code (never imported by app code). See `spikes/wolt-import/REPORT.md` — **Wolt import: FEASIBLE.**

## Milestone status
- **M0 (foundations): COMPLETE** — schema+RLS live on Supabase dev, tenant resolution working, isolation suite green, Wolt spike positive.
- Next: M1 — branded read-only storefront (Home Burger design parity).
