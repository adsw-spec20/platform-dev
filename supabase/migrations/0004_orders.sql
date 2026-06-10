-- 0004: ordering core. All money INTEGER AGOROT.

create table public.tenant_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  delivery_enabled boolean not null default true,
  pickup_enabled boolean not null default true,
  delivery_fee int not null default 0 check (delivery_fee >= 0),
  min_order int not null default 0 check (min_order >= 0),
  prep_minutes int not null default 30,
  updated_at timestamptz not null default now()
);

-- Per-tenant sequential order numbers (atomic via row update).
create table public.order_counters (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  last_number int not null default 0
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  number int not null,
  status text not null default 'new'
    check (status in ('new', 'preparing', 'ready', 'out_for_delivery', 'completed', 'canceled')),
  method text not null check (method in ('delivery', 'pickup')),
  payment_method text not null default 'cash' check (payment_method in ('cash')),
  payment_status text not null default 'na' check (payment_status in ('pending', 'paid', 'na')),
  customer_name text not null,
  customer_phone text not null,
  address jsonb,
  customer_notes text,
  items jsonb not null, -- price-stamped snapshot at order time
  subtotal int not null check (subtotal >= 0),
  delivery_fee int not null default 0 check (delivery_fee >= 0),
  total int not null check (total >= 0),
  scheduled_time timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, number)
);

create index orders_tenant_created on public.orders (tenant_id, created_at desc);
create index orders_tenant_status on public.orders (tenant_id, status);

alter table public.tenant_settings enable row level security;
alter table public.order_counters enable row level security;
alter table public.orders enable row level security;

create policy tenant_settings_staff_select on public.tenant_settings
  for select to authenticated
  using (tenant_id = app.current_tenant_id());

create policy tenant_settings_staff_update on public.tenant_settings
  for update to authenticated
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

-- order_counters: service-role only (no client policies).

create policy orders_staff_select on public.orders
  for select to authenticated
  using (tenant_id = app.current_tenant_id());

create policy orders_staff_update on public.orders
  for update to authenticated
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());
-- Order INSERT is server-side only (service role) - clients never create orders directly.

-- Live updates for dashboard + tracking.
alter publication supabase_realtime add table public.orders;
