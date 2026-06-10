# Platform Milestone 0 — Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the new multi-tenant SaaS repo with a Supabase schema where every table is tenant-scoped and RLS-enforced, domain-based tenant resolution in Next.js middleware, two seeded demo tenants, a passing automated tenant-isolation test suite, and a Wolt-import feasibility report.

**Architecture:** One Next.js app (App Router, TypeScript) on a new repo at `c:\Users\Adir\platform`, talking to a hosted Supabase dev project. Staff/dashboard data access goes through Supabase clients governed by RLS keyed on a `tenant_id` JWT claim (`app_metadata.tenant_id`). Anonymous storefront reads will go through server-side code only (service role + explicit tenant scoping) — anon PostgREST access is denied by RLS. Tenant resolution: `Host` header → pure parser → DB lookup (cached) → request headers `x-tenant-id`/`x-tenant-slug`.

**Tech Stack:** Next.js (App Router) + TypeScript + Tailwind, Supabase (hosted dev project, CLI-managed SQL migrations), supabase-js v2, Vitest, tsx, dotenv.

**Critical constraints (from spec `docs/superpowers/specs/2026-06-10-saas-platform-design.md` in the HBv1.0 repo):**
- **Never modify anything inside `c:\Users\Adir\HBv1.0`.** All tasks operate in the NEW repo `c:\Users\Adir\platform`. (This plan file lives in HBv1.0 temporarily; copy it to the new repo in Task 1.)
- All money columns are **integer agorot**. No floats, ever.
- Every domain table carries `tenant_id uuid not null` + RLS. No exceptions.
- The isolation test suite (Task 10) is the milestone's iron rule: it must pass before Milestone 0 is called done.
- The platform brand name is not chosen yet. The repo/dir name `platform` and root domain placeholder are intentional; renaming later is cheap (env var + dir rename).

**Out of scope for Milestone 0 (deliberate):** Vercel deployment (Milestone 1), storefront UI (M1), checkout/orders (M2), payments (M4), webhooks (M5), onboarding wizard (M7). No GitHub Actions CI yet — tests run locally via npm scripts.

---

## Prerequisites (Adir's machine, guided one-time setup)

Task 1 verifies these and stops with instructions if missing:
- Node.js 20+ (`node -v`)
- Git (`git --version`)
- A Supabase account (free tier is fine) — dashboard access at supabase.com
- No Docker required (we use a hosted dev project, not local Supabase).

---

### Task 1: Create the new repo

**Files:**
- Create: `c:\Users\Adir\platform\` (entire Next.js scaffold)
- Create: `c:\Users\Adir\platform\docs\plans\2026-06-10-platform-milestone-0.md` (copy of this plan)

- [ ] **Step 1: Verify prerequisites**

Run:
```powershell
node -v; git --version
```
Expected: Node `v20.x` or higher, git version output. If Node < 20 or missing: install Node LTS from nodejs.org, then re-run.

- [ ] **Step 2: Scaffold Next.js app**

Run:
```powershell
npx create-next-app@latest C:\Users\Adir\platform --ts --app --tailwind --eslint --src-dir --import-alias "@/*" --use-npm
```
Answer any remaining interactive prompts with the defaults. Expected: "Success! Created platform".

- [ ] **Step 3: Verify dev server boots**

Run (from `C:\Users\Adir\platform`):
```powershell
npm run dev
```
Expected: "Ready" with local URL. Open http://localhost:3000 — default Next.js page renders. Stop with Ctrl+C.

- [ ] **Step 4: Copy this plan into the new repo**

```powershell
New-Item -ItemType Directory -Force C:\Users\Adir\platform\docs\plans
Copy-Item C:\Users\Adir\HBv1.0\docs\superpowers\plans\2026-06-10-platform-milestone-0.md C:\Users\Adir\platform\docs\plans\
```

- [ ] **Step 5: Initial commit**

```powershell
git add -A
git commit -m "chore: scaffold Next.js app + milestone 0 plan"
```
(create-next-app already ran `git init`.)

---

### Task 2: Vitest setup with a smoke test

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `tests/smoke.test.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Install dev dependencies**

```powershell
npm i -D vitest dotenv tsx
```

- [ ] **Step 2: Create config and setup files**

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    testTimeout: 30_000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
```

`tests/setup.ts`:
```ts
import { config } from "dotenv";
config({ path: ".env.local" });
```

`tests/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("vitest runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 3: Add npm scripts**

In `package.json` `"scripts"`, add:
```json
"test": "vitest run",
"test:isolation": "vitest run tests/isolation"
```

- [ ] **Step 4: Run and verify**

```powershell
npm test
```
Expected: `1 passed`.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "chore: vitest setup with smoke test"
```

---

### Task 3: Supabase dev project + CLI link + env vars

This task involves the Supabase dashboard (browser). Guide Adir through clicks where needed.

**Files:**
- Create: `supabase/` (CLI init)
- Create: `.env.local`
- Create: `.env.local.example`
- Modify: `.gitignore` (verify `.env*` ignored)

- [ ] **Step 1: Create hosted project (dashboard)**

In supabase.com dashboard: New project → name `platform-dev` → region `Central EU (Frankfurt)` (closest to Israel) → generate a strong DB password and **save it** (needed in Step 3). Wait until project status is active.

- [ ] **Step 2: Collect keys**

From Project Settings → API: copy `Project URL`, `anon` key, `service_role` key. From Project Settings → General: copy `Reference ID`.

Create `.env.local`:
```ini
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
SUPABASE_DB_PASSWORD=<db password>
PLATFORM_ROOT_DOMAIN=localtest.me
TEST_STAFF_PASSWORD=Demo!Pass#2026
```

Create `.env.local.example` with the same keys and placeholder values (no secrets).

- [ ] **Step 3: Install CLI, login, link**

```powershell
npm i -D supabase
npx supabase login
npx supabase init
npx supabase link --project-ref <project-ref> --password $env:SUPABASE_DB_PASSWORD
```
`supabase login` opens a browser for an access token — approve it. Expected after link: "Finished supabase link".

- [ ] **Step 4: Verify gitignore covers env files**

Check `.gitignore` contains `.env*` (create-next-app default does). `.env.local.example` should be force-added:
```powershell
git add -f .env.local.example
```

- [ ] **Step 5: Verify connection**

```powershell
npx supabase migration list --password $env:SUPABASE_DB_PASSWORD
```
Expected: empty migration table output (no error).

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "chore: supabase CLI init + linked dev project + env example"
```

---

### Task 4: Migration 1 — app schema, tenants, themes (+ RLS)

**Files:**
- Create: `supabase/migrations/0001_tenants_themes.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0001: core tenancy. All money anywhere in this DB is INTEGER AGOROT.
create schema if not exists app;

-- Current tenant from the signed-in user's JWT (app_metadata.tenant_id).
create or replace function app.current_tenant_id()
returns uuid
language sql stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid
$$;

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}$'),
  name text not null,
  custom_domain text unique,
  status text not null default 'trial'
    check (status in ('trial', 'active', 'past_due', 'suspended')),
  created_at timestamptz not null default now()
);

create table public.themes (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  primary_color text not null default '#DC2626',
  secondary_color text not null default '#1F2937',
  accent_color text not null default '#F59E0B',
  background_color text not null default '#FFFFFF',
  text_color text not null default '#111827',
  font_family text not null default 'Heebo',
  logo_url text,
  updated_at timestamptz not null default now()
);

alter table public.tenants enable row level security;
alter table public.themes enable row level security;

-- Staff may read their own tenant row. No client-side writes in M0
-- (tenant creation is service-role only; storefront reads are server-side DAL).
create policy tenants_staff_select on public.tenants
  for select to authenticated
  using (id = app.current_tenant_id());

create policy themes_staff_select on public.themes
  for select to authenticated
  using (tenant_id = app.current_tenant_id());

create policy themes_staff_update on public.themes
  for update to authenticated
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());
```

- [ ] **Step 2: Push and verify**

```powershell
npx supabase db push --password $env:SUPABASE_DB_PASSWORD
```
Expected: "Applying migration 0001_tenants_themes.sql... Finished supabase db push." Verify in dashboard Table Editor: `tenants`, `themes` exist with RLS badge ON.

- [ ] **Step 3: Commit**

```powershell
git add supabase/migrations/0001_tenants_themes.sql
git commit -m "feat(db): tenants + themes with RLS"
```

---

### Task 5: Migration 2 — roles + staff members (+ RLS)

**Files:**
- Create: `supabase/migrations/0002_roles_staff.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0002: clean permission model. Single source of truth:
-- role -> permissions[]; staff member -> role. No per-user permission flags.
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  key text not null,
  name text not null,
  permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, key)
);

create table public.staff_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

alter table public.roles enable row level security;
alter table public.staff_members enable row level security;

create policy roles_staff_select on public.roles
  for select to authenticated
  using (tenant_id = app.current_tenant_id());

create policy staff_members_staff_select on public.staff_members
  for select to authenticated
  using (tenant_id = app.current_tenant_id());
-- Role/staff management UI arrives in Milestone 3; writes are service-role only until then.
```

- [ ] **Step 2: Push and verify**

```powershell
npx supabase db push --password $env:SUPABASE_DB_PASSWORD
```
Expected: migration applied. Dashboard: `roles`, `staff_members` exist, RLS ON.

- [ ] **Step 3: Commit**

```powershell
git add supabase/migrations/0002_roles_staff.sql
git commit -m "feat(db): roles + staff_members with RLS (single-source-of-truth permissions)"
```

---

### Task 6: Migration 3 — menu tables with composite tenant FKs (+ RLS)

**Files:**
- Create: `supabase/migrations/0003_menu.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0003: menu core. Prices are INTEGER AGOROT (5500 = 55.00 ILS).
-- Composite FKs (child.tenant_id must equal parent.tenant_id) make
-- cross-tenant parenting impossible even with service-role bugs.
create table public.menu_categories (
  id uuid not null default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (id, tenant_id)
);

create table public.menu_items (
  id uuid not null default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  category_id uuid not null,
  name text not null,
  description text,
  price int not null check (price >= 0), -- agorot
  image_url text,
  sort_order int not null default 0,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (id, tenant_id),
  foreign key (category_id, tenant_id)
    references public.menu_categories(id, tenant_id) on delete cascade
);

create table public.option_groups (
  id uuid not null default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  item_id uuid not null,
  name text not null,
  type text not null default 'multi'
    check (type in ('single', 'multi', 'quantity', 'text')),
  required boolean not null default false,
  min_select int not null default 0,
  max_select int,
  free_quantity int not null default 0, -- "n free, rest paid" rule
  sort_order int not null default 0,
  primary key (id),
  unique (id, tenant_id),
  foreign key (item_id, tenant_id)
    references public.menu_items(id, tenant_id) on delete cascade
);

create table public.options (
  id uuid not null default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  group_id uuid not null,
  name text not null,
  price_delta int not null default 0 check (price_delta >= 0), -- agorot per unit
  max_qty int,
  is_default boolean not null default false,
  sort_order int not null default 0,
  primary key (id),
  unique (id, tenant_id),
  foreign key (group_id, tenant_id)
    references public.option_groups(id, tenant_id) on delete cascade
);

alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.option_groups enable row level security;
alter table public.options enable row level security;

-- Staff full access to own tenant; anon gets nothing (storefront reads are server-side DAL).
do $$
declare t text;
begin
  foreach t in array array['menu_categories', 'menu_items', 'option_groups', 'options']
  loop
    execute format(
      'create policy %I_staff_all on public.%I for all to authenticated
       using (tenant_id = app.current_tenant_id())
       with check (tenant_id = app.current_tenant_id())', t, t);
  end loop;
end $$;
```

- [ ] **Step 2: Push and verify**

```powershell
npx supabase db push --password $env:SUPABASE_DB_PASSWORD
```
Expected: applied. Dashboard: 4 menu tables, RLS ON.

- [ ] **Step 3: Commit**

```powershell
git add supabase/migrations/0003_menu.sql
git commit -m "feat(db): menu schema with composite tenant FKs and RLS, prices in agorot"
```

---

### Task 7: Seed script — two demo tenants, staff users, menus

**Files:**
- Create: `scripts/seed-demo.ts`
- Modify: `package.json` (script `"seed": "tsx scripts/seed-demo.ts"`)

- [ ] **Step 1: Write the seed script**

```ts
/**
 * Seeds two demo tenants for development and isolation tests.
 * Idempotent: safe to run repeatedly (upserts by slug/email).
 * Uses service role - run locally only, never ship to client code.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const staffPassword = process.env.TEST_STAFF_PASSWORD!;
if (!url || !serviceKey || !staffPassword) throw new Error("Missing env vars");

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

type MenuSeed = {
  category: string;
  items: {
    name: string;
    price: number; // agorot
    groups?: {
      name: string;
      type: "single" | "multi";
      required?: boolean;
      free_quantity?: number;
      max_select?: number;
      options: { name: string; price_delta?: number }[];
    }[];
  }[];
}[];

const TENANTS: {
  slug: string;
  name: string;
  ownerEmail: string;
  menu: MenuSeed;
}[] = [
  {
    slug: "demo-a",
    name: "דמו בורגרים",
    ownerEmail: "owner-a@demo.test",
    menu: [
      {
        category: "בורגרים",
        items: [
          {
            name: "המבורגר קלאסי",
            price: 5500,
            groups: [
              {
                name: "מידת עשייה",
                type: "single",
                required: true,
                options: [{ name: "מדיום" }, { name: "וול דאן" }],
              },
              {
                name: "תוספות לבורגר",
                type: "multi",
                free_quantity: 2,
                max_select: 5,
                options: [
                  { name: "חסה", price_delta: 400 },
                  { name: "עגבנייה", price_delta: 400 },
                  { name: "בצל מקורמל", price_delta: 400 },
                  { name: "ביצת עין", price_delta: 600 },
                  { name: "צ'דר", price_delta: 600 },
                ],
              },
            ],
          },
          { name: "צ'יזבורגר כפול", price: 7200 },
        ],
      },
      {
        category: "תוספות",
        items: [
          { name: "צ'יפס", price: 1800 },
          { name: "טבעות בצל", price: 2200 },
        ],
      },
    ],
  },
  {
    slug: "demo-b",
    name: "דמו פיצה",
    ownerEmail: "owner-b@demo.test",
    menu: [
      {
        category: "פיצות",
        items: [
          {
            name: "מרגריטה",
            price: 5800,
            groups: [
              {
                name: "גודל",
                type: "single",
                required: true,
                options: [
                  { name: "אישית" },
                  { name: "משפחתית", price_delta: 1700 },
                ],
              },
              {
                name: "תוספות",
                type: "multi",
                max_select: 5,
                options: [
                  { name: "זיתים", price_delta: 500 },
                  { name: "פטריות", price_delta: 500 },
                  { name: "בצל", price_delta: 400 },
                ],
              },
            ],
          },
        ],
      },
      {
        category: "שתייה",
        items: [{ name: "קולה", price: 1200 }],
      },
    ],
  },
];

async function upsertTenant(slug: string, name: string): Promise<string> {
  const { data: existing } = await admin
    .from("tenants").select("id").eq("slug", slug).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await admin
    .from("tenants").insert({ slug, name }).select("id").single();
  if (error) throw error;
  await admin.from("themes").insert({ tenant_id: data.id });
  return data.id;
}

async function upsertOwner(email: string, tenantId: string): Promise<string> {
  const created = await admin.auth.admin.createUser({
    email,
    password: staffPassword,
    email_confirm: true,
    app_metadata: { tenant_id: tenantId },
  });
  if (created.data.user) return created.data.user.id;
  // Already exists: find and re-stamp tenant claim.
  const { data: list, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const user = list.users.find((u) => u.email === email);
  if (!user) throw new Error(`Cannot create or find user ${email}`);
  await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { tenant_id: tenantId },
  });
  return user.id;
}

async function upsertOwnerRole(tenantId: string): Promise<string> {
  const { data: existing } = await admin
    .from("roles").select("id")
    .eq("tenant_id", tenantId).eq("key", "owner").maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await admin
    .from("roles")
    .insert({
      tenant_id: tenantId,
      key: "owner",
      name: "בעלים",
      permissions: ["*"],
    })
    .select("id").single();
  if (error) throw error;
  return data.id;
}

async function seedMenu(tenantId: string, menu: MenuSeed) {
  const { count } = await admin
    .from("menu_categories")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if ((count ?? 0) > 0) {
    console.log(`  menu already seeded for ${tenantId}, skipping`);
    return;
  }
  for (const [ci, cat] of menu.entries()) {
    const { data: category, error: ce } = await admin
      .from("menu_categories")
      .insert({ tenant_id: tenantId, name: cat.category, sort_order: ci })
      .select("id").single();
    if (ce) throw ce;
    for (const [ii, item] of cat.items.entries()) {
      const { data: row, error: ie } = await admin
        .from("menu_items")
        .insert({
          tenant_id: tenantId,
          category_id: category.id,
          name: item.name,
          price: item.price,
          sort_order: ii,
        })
        .select("id").single();
      if (ie) throw ie;
      for (const [gi, g] of (item.groups ?? []).entries()) {
        const { data: group, error: ge } = await admin
          .from("option_groups")
          .insert({
            tenant_id: tenantId,
            item_id: row.id,
            name: g.name,
            type: g.type,
            required: g.required ?? false,
            free_quantity: g.free_quantity ?? 0,
            max_select: g.max_select ?? null,
            sort_order: gi,
          })
          .select("id").single();
        if (ge) throw ge;
        for (const [oi, o] of g.options.entries()) {
          const { error: oe } = await admin.from("options").insert({
            tenant_id: tenantId,
            group_id: group.id,
            name: o.name,
            price_delta: o.price_delta ?? 0,
            sort_order: oi,
          });
          if (oe) throw oe;
        }
      }
    }
  }
}

async function main() {
  for (const t of TENANTS) {
    console.log(`Seeding ${t.slug}...`);
    const tenantId = await upsertTenant(t.slug, t.name);
    const roleId = await upsertOwnerRole(tenantId);
    const userId = await upsertOwner(t.ownerEmail, tenantId);
    const { error } = await admin
      .from("staff_members")
      .upsert(
        { tenant_id: tenantId, user_id: userId, role_id: roleId },
        { onConflict: "tenant_id,user_id" }
      );
    if (error) throw error;
    await seedMenu(tenantId, t.menu);
    console.log(`  done: tenant=${tenantId}`);
  }
  console.log("Seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Install runtime dep and add script**

```powershell
npm i @supabase/supabase-js
```
Add to `package.json` scripts: `"seed": "tsx scripts/seed-demo.ts"`.

- [ ] **Step 3: Run the seed**

```powershell
npm run seed
```
Expected output: `Seeding demo-a... done`, `Seeding demo-b... done`, `Seed complete.`

- [ ] **Step 4: Verify in dashboard**

Table editor: `tenants` has 2 rows; `menu_items` has 5 rows total with correct `tenant_id` split (3 demo-a items + categories, 2 demo-b); Auth → Users shows `owner-a@demo.test`, `owner-b@demo.test`.

- [ ] **Step 5: Run seed again (idempotency check)**

```powershell
npm run seed
```
Expected: completes without errors, "menu already seeded" messages, row counts unchanged.

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "feat: idempotent demo seed - two tenants with staff and menus"
```

---

### Task 8: Host parser (TDD)

**Files:**
- Create: `src/lib/tenant/parse-host.ts`
- Test: `tests/unit/parse-host.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/parse-host.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseHost } from "@/lib/tenant/parse-host";

const ROOT = "localtest.me";

describe("parseHost", () => {
  it("null host is invalid", () => {
    expect(parseHost(null, ROOT)).toEqual({ kind: "invalid" });
  });

  it("root domain resolves to root", () => {
    expect(parseHost("localtest.me", ROOT)).toEqual({ kind: "root" });
    expect(parseHost("www.localtest.me", ROOT)).toEqual({ kind: "root" });
    expect(parseHost("localhost", ROOT)).toEqual({ kind: "root" });
  });

  it("strips port and lowercases", () => {
    expect(parseHost("Demo-A.LocalTest.me:3000", ROOT)).toEqual({
      kind: "subdomain",
      slug: "demo-a",
    });
  });

  it("single-level subdomain of root is a tenant slug", () => {
    expect(parseHost("demo-b.localtest.me", ROOT)).toEqual({
      kind: "subdomain",
      slug: "demo-b",
    });
  });

  it("nested subdomain is invalid", () => {
    expect(parseHost("a.b.localtest.me", ROOT)).toEqual({ kind: "invalid" });
  });

  it("any other domain is a custom tenant domain", () => {
    expect(parseHost("pizzaninja.co.il", ROOT)).toEqual({
      kind: "custom",
      domain: "pizzaninja.co.il",
    });
    expect(parseHost("www.pizzaninja.co.il", ROOT)).toEqual({
      kind: "custom",
      domain: "pizzaninja.co.il",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
npx vitest run tests/unit/parse-host.test.ts
```
Expected: FAIL — cannot resolve `@/lib/tenant/parse-host`.

- [ ] **Step 3: Implement**

`src/lib/tenant/parse-host.ts`:
```ts
export type HostResolution =
  | { kind: "root" }
  | { kind: "subdomain"; slug: string }
  | { kind: "custom"; domain: string }
  | { kind: "invalid" };

/** Pure host-header parser. No I/O - DB lookup happens in resolve.ts. */
export function parseHost(
  rawHost: string | null,
  rootDomain: string
): HostResolution {
  if (!rawHost) return { kind: "invalid" };
  const host = rawHost.toLowerCase().split(":")[0];
  const root = rootDomain.toLowerCase();

  if (host === root || host === `www.${root}` || host === "localhost") {
    return { kind: "root" };
  }

  if (host.endsWith(`.${root}`)) {
    const prefix = host.slice(0, -(root.length + 1));
    if (prefix.includes(".")) return { kind: "invalid" };
    return { kind: "subdomain", slug: prefix };
  }

  const domain = host.startsWith("www.") ? host.slice(4) : host;
  if (!domain.includes(".")) return { kind: "invalid" };
  return { kind: "custom", domain };
}
```

- [ ] **Step 4: Run test to verify it passes**

```powershell
npx vitest run tests/unit/parse-host.test.ts
```
Expected: all 6 PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/tenant/parse-host.ts tests/unit/parse-host.test.ts
git commit -m "feat: pure host parser for tenant resolution (TDD)"
```

---

### Task 9: Tenant resolver, middleware, debug endpoint

**Files:**
- Create: `src/lib/tenant/resolve.ts`
- Create: `src/middleware.ts`
- Create: `src/app/api/debug/tenant/route.ts`

- [ ] **Step 1: Write the resolver**

`src/lib/tenant/resolve.ts`:
```ts
import { createClient } from "@supabase/supabase-js";
import type { HostResolution } from "./parse-host";

export type ResolvedTenant = {
  id: string;
  slug: string;
  name: string;
  status: string;
};

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { tenant: ResolvedTenant | null; at: number }>();

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/** Looks up the tenant for a parsed host. Cached for 60s per key. */
export async function resolveTenant(
  res: HostResolution
): Promise<ResolvedTenant | null> {
  if (res.kind !== "subdomain" && res.kind !== "custom") return null;
  const key = res.kind === "subdomain" ? `s:${res.slug}` : `c:${res.domain}`;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.tenant;

  const db = adminClient();
  const query = db.from("tenants").select("id, slug, name, status");
  const { data } =
    res.kind === "subdomain"
      ? await query.eq("slug", res.slug).maybeSingle()
      : await query.eq("custom_domain", res.domain).maybeSingle();

  const tenant = (data as ResolvedTenant | null) ?? null;
  cache.set(key, { tenant, at: Date.now() });
  return tenant;
}
```

- [ ] **Step 2: Write the middleware**

`src/middleware.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { parseHost } from "@/lib/tenant/parse-host";
import { resolveTenant } from "@/lib/tenant/resolve";

export async function middleware(req: NextRequest) {
  const parsed = parseHost(
    req.headers.get("host"),
    process.env.PLATFORM_ROOT_DOMAIN ?? "localtest.me"
  );

  // Root domain = platform pages (marketing/wizard later). Pass through.
  if (parsed.kind === "root") return NextResponse.next();

  if (parsed.kind === "invalid") {
    return new NextResponse("Not found", { status: 404 });
  }

  const tenant = await resolveTenant(parsed);
  if (!tenant) {
    return new NextResponse("Store not found", { status: 404 });
  }

  const headers = new Headers(req.headers);
  headers.set("x-tenant-id", tenant.id);
  headers.set("x-tenant-slug", tenant.slug);
  headers.set("x-tenant-status", tenant.status);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 3: Write the debug endpoint**

`src/app/api/debug/tenant/route.ts`:
```ts
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  if (!tenantId) {
    return NextResponse.json({ tenant: null, note: "root or unresolved host" });
  }
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  // Server-side DAL pattern: service role + EXPLICIT tenant scoping, always.
  const [{ count: categories }, { count: items }] = await Promise.all([
    db.from("menu_categories")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    db.from("menu_items")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
  ]);
  return NextResponse.json({
    tenant: {
      id: tenantId,
      slug: h.get("x-tenant-slug"),
      status: h.get("x-tenant-status"),
    },
    counts: { categories, items },
  });
}
```

- [ ] **Step 4: Manual verification**

```powershell
npm run dev
```
Then in a second terminal:
```powershell
curl.exe -s http://demo-a.localtest.me:3000/api/debug/tenant
curl.exe -s http://demo-b.localtest.me:3000/api/debug/tenant
curl.exe -s -o NUL -w "%{http_code}" http://no-such.localtest.me:3000/api/debug/tenant
curl.exe -s http://localhost:3000/api/debug/tenant
```
Expected, in order:
1. JSON with demo-a tenant id, `categories: 2, items: 4`
2. JSON with demo-b tenant id, `categories: 2, items: 2`
3. `404`
4. `{"tenant":null,...}` (root)

Stop dev server.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/tenant/resolve.ts src/middleware.ts src/app/api/debug/tenant/route.ts
git commit -m "feat: domain-based tenant resolution middleware + debug endpoint"
```

---

### Task 10: Tenant-isolation test suite (the iron rule)

**Files:**
- Create: `tests/isolation/helpers.ts`
- Test: `tests/isolation/tenant-isolation.test.ts`

- [ ] **Step 1: Write helpers**

`tests/isolation/helpers.ts`:
```ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function anonClient(): SupabaseClient {
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

export function adminClient(): SupabaseClient {
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/** Signs in a seeded staff user; returns an RLS-governed client. */
export async function staffClient(email: string): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({
    email,
    password: process.env.TEST_STAFF_PASSWORD!,
  });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  return client;
}

export async function tenantIdBySlug(slug: string): Promise<string> {
  const { data, error } = await adminClient()
    .from("tenants").select("id").eq("slug", slug).single();
  if (error) throw error;
  return data.id;
}
```

- [ ] **Step 2: Write the isolation tests**

`tests/isolation/tenant-isolation.test.ts`:
```ts
import { describe, it, expect, beforeAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  anonClient,
  adminClient,
  staffClient,
  tenantIdBySlug,
} from "./helpers";

let ownerA: SupabaseClient;
let tenantA: string;
let tenantB: string;

beforeAll(async () => {
  ownerA = await staffClient("owner-a@demo.test");
  tenantA = await tenantIdBySlug("demo-a");
  tenantB = await tenantIdBySlug("demo-b");
});

describe("tenant isolation (iron rule)", () => {
  it("staff A sees only tenant A menu items", async () => {
    const { data, error } = await ownerA.from("menu_items").select("name, tenant_id");
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.every((r) => r.tenant_id === tenantA)).toBe(true);
    expect(data!.map((r) => r.name)).toContain("המבורגר קלאסי");
    expect(data!.map((r) => r.name)).not.toContain("מרגריטה");
  });

  it("staff A gets zero rows even when explicitly filtering for tenant B", async () => {
    const { data, error } = await ownerA
      .from("menu_items").select("id").eq("tenant_id", tenantB);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("staff A sees only their own tenant row", async () => {
    const { data, error } = await ownerA.from("tenants").select("id, slug");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].slug).toBe("demo-a");
  });

  it("staff A cannot update tenant B's items", async () => {
    const admin = adminClient();
    const { data: target } = await admin
      .from("menu_items").select("id, name")
      .eq("tenant_id", tenantB).limit(1).single();

    const { data: updated, error } = await ownerA
      .from("menu_items")
      .update({ name: "HACKED" })
      .eq("id", target!.id)
      .select();
    // RLS: zero rows matched, no error surfaced, nothing changed.
    expect(error).toBeNull();
    expect(updated).toHaveLength(0);

    const { data: after } = await admin
      .from("menu_items").select("name").eq("id", target!.id).single();
    expect(after!.name).toBe(target!.name);
  });

  it("staff A cannot insert rows stamped with tenant B's id", async () => {
    const { data: catB } = await adminClient()
      .from("menu_categories").select("id")
      .eq("tenant_id", tenantB).limit(1).single();

    const { error } = await ownerA.from("menu_items").insert({
      tenant_id: tenantB,
      category_id: catB!.id,
      name: "smuggled item",
      price: 100,
    });
    expect(error).not.toBeNull(); // RLS with-check violation
  });

  it("anonymous client reads nothing from any tenant table", async () => {
    const anon = anonClient();
    for (const table of [
      "tenants",
      "themes",
      "roles",
      "staff_members",
      "menu_categories",
      "menu_items",
      "option_groups",
      "options",
    ]) {
      const { data } = await anon.from(table).select("*").limit(5);
      expect(data ?? []).toHaveLength(0);
    }
  });

  it("staff A cannot read tenant B's staff or roles", async () => {
    const { data: staff } = await ownerA.from("staff_members").select("tenant_id");
    expect(staff!.every((r) => r.tenant_id === tenantA)).toBe(true);
    const { data: roles } = await ownerA.from("roles").select("tenant_id");
    expect(roles!.every((r) => r.tenant_id === tenantA)).toBe(true);
  });
});
```

- [ ] **Step 3: Run the suite**

```powershell
npm run test:isolation
```
Expected: **7 passed, 0 failed.** If any test fails, STOP — this is a security defect; fix the policy before anything else.

- [ ] **Step 4: Run the full test suite**

```powershell
npm test
```
Expected: smoke + parse-host + isolation all pass.

- [ ] **Step 5: Commit**

```powershell
git add tests/isolation/
git commit -m "test: tenant isolation suite - the iron rule for this codebase"
```

---

### Task 11: Wolt import feasibility spike

Throwaway research code — lives under `spikes/`, never imported by app code. Goal: determine whether QuickFood-grade Wolt import (paste URL → categories, items, images, option groups with min/max/free-quantity) is technically feasible, and produce a written report.

**Files:**
- Create: `spikes/wolt-import/fetch.ts`
- Create: `spikes/wolt-import/REPORT.md` (written after running)

- [ ] **Step 1: Write the spike script**

`spikes/wolt-import/fetch.ts`:
```ts
/**
 * SPIKE (throwaway): probe Wolt's public venue endpoints for menu data.
 * Usage: npx tsx spikes/wolt-import/fetch.ts https://wolt.com/he/isr/ramla/restaurant/<slug>
 * Writes raw JSON responses to spikes/wolt-import/out/ for analysis.
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const venueUrl = process.argv[2];
if (!venueUrl) {
  console.error("Usage: npx tsx spikes/wolt-import/fetch.ts <wolt venue URL>");
  process.exit(1);
}
const slug = venueUrl.replace(/\/+$/, "").split("/").pop()!;
console.log(`Venue slug: ${slug}`);

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "application/json",
  "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
};

const CANDIDATES = [
  `https://restaurant-api.wolt.com/v3/venues/slug/${slug}`,
  `https://restaurant-api.wolt.com/v4/venues/slug/${slug}/menu`,
  `https://restaurant-api.wolt.com/v4/venues/slug/${slug}/menu/data`,
  `https://consumer-api.wolt.com/order-xp/web/v1/venue/slug/${slug}/dynamic/`,
  `https://consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/${slug}/assortment`,
];

const outDir = join("spikes", "wolt-import", "out");
mkdirSync(outDir, { recursive: true });

for (const url of CANDIDATES) {
  try {
    const res = await fetch(url, { headers: HEADERS });
    const name = url.replace(/[^a-z0-9]+/gi, "_").slice(0, 80) + ".json";
    console.log(`${res.status}  ${url}`);
    if (res.ok) {
      const body = await res.text();
      writeFileSync(join(outDir, name), body);
      console.log(`   -> saved ${name} (${body.length} bytes)`);
    }
  } catch (e) {
    console.log(`ERR   ${url}: ${(e as Error).message}`);
  }
}
console.log("\nDone. Inspect spikes/wolt-import/out/*.json");
```

- [ ] **Step 2: Run against two real venues**

Pick two live Israeli Wolt venue URLs (e.g., from wolt.com search — a pizza place and a burger place). Run:
```powershell
npx tsx spikes/wolt-import/fetch.ts <venue-url-1>
npx tsx spikes/wolt-import/fetch.ts <venue-url-2>
```
Expected: at least one endpoint returns 200 with JSON. If ALL return 403/blocked: note it and proceed to Step 3 fallback analysis.

- [ ] **Step 3: Analyze coverage and write REPORT.md**

Open the saved JSON and verify, for each spec requirement, whether the data exists. Write `spikes/wolt-import/REPORT.md` with this exact structure (fill VERDICT per row from actual data — `YES/PARTIAL/NO` + JSON path evidence):

```markdown
# Wolt Import Feasibility Report

Date: <run date>
Venues probed: <urls>
Working endpoints: <list + status codes>

| Requirement (spec §10.5)        | Verdict | Evidence (JSON path)       |
| ------------------------------- | ------- | -------------------------- |
| Categories (incl. subcategories)|         |                            |
| Items + descriptions            |         |                            |
| Item prices                     |         |                            |
| Item images                     |         |                            |
| Venue logo + cover image        |         |                            |
| Opening hours                   |         |                            |
| Address + phone                 |         |                            |
| Option groups                   |         |                            |
| Option min/max selections       |         |                            |
| Option free-quantity rules      |         |                            |
| Option prices                   |         |                            |

## Blocking risks
<rate limits, 403s, auth walls, TOS considerations>

## Recommended import architecture for Milestone 8
<server-side fetch on demand vs. headless-browser fallback; mapping notes to our schema>

## Fallback assessment
<if endpoints blocked: Playwright headless capture viability>
```

- [ ] **Step 4: Commit**

```powershell
git add spikes/wolt-import/
git commit -m "spike: Wolt import feasibility probe + report"
```
(Note: `out/*.json` raw dumps may be large — add `spikes/wolt-import/out/` to `.gitignore` and commit only the script + REPORT.md.)

---

### Task 12: README + milestone wrap-up

**Files:**
- Create: `README.md` (replace scaffold default)

- [ ] **Step 1: Write README.md**

```markdown
# Platform (working name)

Multi-tenant restaurant-ordering SaaS. Spec: `docs/` (synced from HBv1.0 repo).

## Non-negotiable rules
1. **Tenant isolation:** every table has `tenant_id` + RLS. `npm run test:isolation` must pass before every merge.
2. **Money is integer agorot.** Never float.
3. **Theming is data.** No hardcoded colors/brand in components — design tokens only.
4. **Anon clients get nothing from PostgREST.** Storefront reads go through server-side code with explicit tenant scoping.
5. The HBv1.0 repo (`c:\Users\Adir\HBv1.0`) is read-only reference. Never modify it.

## Setup
1. `npm install`
2. Copy `.env.local.example` → `.env.local`, fill from Supabase dashboard
3. `npx supabase link --project-ref <ref> --password $env:SUPABASE_DB_PASSWORD`
4. `npx supabase db push --password $env:SUPABASE_DB_PASSWORD`
5. `npm run seed`
6. `npm run dev` → http://demo-a.localtest.me:3000/api/debug/tenant

## Commands
- `npm test` — all tests
- `npm run test:isolation` — tenant isolation suite (the iron rule)
- `npm run seed` — idempotent demo data
- `npx supabase db push` — apply new migrations

## Structure
- `supabase/migrations/` — schema (SQL, numbered)
- `src/lib/tenant/` — host parsing + tenant resolution
- `src/middleware.ts` — domain → tenant
- `tests/isolation/` — cross-tenant access tests
- `spikes/` — throwaway research code (never imported by app code)
```

- [ ] **Step 2: Final verification — full suite from clean state**

```powershell
npm run seed
npm test
```
Expected: seed idempotent-clean, all tests pass.

- [ ] **Step 3: Commit**

```powershell
git add README.md
git commit -m "docs: README with non-negotiable rules and setup guide"
```

- [ ] **Step 4: Milestone 0 acceptance check**

Confirm all true:
1. `npm test` fully green, including 7 isolation tests.
2. `curl http://demo-a.localtest.me:3000/api/debug/tenant` and demo-b return different tenants; unknown subdomain → 404.
3. Seed re-runs cleanly.
4. `spikes/wolt-import/REPORT.md` exists with verdict table filled in.
5. Zero modifications inside `c:\Users\Adir\HBv1.0` (`git -C C:\Users\Adir\HBv1.0 status` shows nothing new beyond the docs committed during planning).

---

## Self-Review Notes (done at write time)

- **Spec coverage (M0 scope):** new repo ✓ (T1), schema core with tenant_id+RLS ✓ (T4-6), auth foundation (staff users + JWT claim) ✓ (T7), tenant resolution by domain ✓ (T8-9), isolation tests ✓ (T10), demo tenant-zero ✓ (T7 — note: full Home Burger menu export deferred to Milestone 1 where storefront parity work needs it; M0 uses representative sample data including the n_free_then_pay rule), Wolt spike ✓ (T11).
- **Type consistency:** `HostResolution` defined in T8, consumed in T9. `app.current_tenant_id()` defined in T4, used in T5/T6 policies. Env var names consistent across T3/T7/T9/T10.
- **No placeholders:** every code step contains full code; commands include expected output. The only intentionally open item is REPORT.md verdicts — they are the *output* of the spike, not a placeholder.
