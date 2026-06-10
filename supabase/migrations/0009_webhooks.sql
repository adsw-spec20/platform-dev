-- 0009: outbound webhooks engine (the QuickFood-style integration layer).
-- Printer/POS/Make are just webhook listeners.

create table public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  url text not null,
  events text[] not null default array['order.created', 'order.status_changed', 'order.cancelled'],
  secret text not null, -- shown once at creation; HMAC key
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  endpoint_id uuid not null references public.webhook_endpoints(id) on delete cascade,
  event text not null,
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'delivered', 'failed', 'abandoned')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_status_code int,
  last_error text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

create index webhook_deliveries_due
  on public.webhook_deliveries (next_attempt_at)
  where status in ('pending', 'failed');
create index webhook_deliveries_tenant
  on public.webhook_deliveries (tenant_id, created_at desc);

alter table public.webhook_endpoints enable row level security;
alter table public.webhook_deliveries enable row level security;

-- Staff manage endpoints; secret is write-mostly (returned once by API).
create policy webhook_endpoints_staff_select on public.webhook_endpoints
  for select to authenticated
  using (tenant_id = app.current_tenant_id());
create policy webhook_endpoints_staff_update on public.webhook_endpoints
  for update to authenticated
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());
create policy webhook_endpoints_staff_delete on public.webhook_endpoints
  for delete to authenticated
  using (tenant_id = app.current_tenant_id());
-- INSERT via server API only (secret generation).

create policy webhook_deliveries_staff_select on public.webhook_deliveries
  for select to authenticated
  using (tenant_id = app.current_tenant_id());
