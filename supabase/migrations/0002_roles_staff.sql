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
