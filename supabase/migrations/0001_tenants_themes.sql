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
