-- 0011: loyalty club (two redemption modes), coupons, related items (upsell).
-- All money INTEGER AGOROT. Loyalty balance keyed per (tenant, normalized phone)
-- until OTP customer accounts land (then accounts attach to verified identities).

alter table public.tenant_settings
  add column loyalty_enabled boolean not null default false,
  add column loyalty_accrual_percent numeric(5,2) not null default 5.0
    check (loyalty_accrual_percent >= 0 and loyalty_accrual_percent <= 50),
  add column loyalty_redemption_mode text not null default 'free_redemption'
    check (loyalty_redemption_mode in ('free_redemption', 'full_item_redemption'));

create table public.loyalty_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  phone text not null, -- normalized 05XXXXXXXX
  balance int not null default 0 check (balance >= 0), -- agorot
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, phone)
);

create table public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  account_id uuid not null references public.loyalty_accounts(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  kind text not null check (kind in ('accrual', 'redemption', 'adjustment')),
  amount int not null, -- agorot, positive=credit negative=debit
  created_at timestamptz not null default now()
);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  kind text not null check (kind in ('percent', 'fixed')),
  value int not null check (value > 0), -- percent (1-100) or agorot
  min_subtotal int not null default 0,
  max_uses int, -- null = unlimited
  used_count int not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);

alter table public.menu_items
  add column related_item_ids uuid[] not null default '{}';

alter table public.loyalty_accounts enable row level security;
alter table public.loyalty_transactions enable row level security;
alter table public.coupons enable row level security;

create policy loyalty_accounts_staff_select on public.loyalty_accounts
  for select to authenticated using (tenant_id = app.current_tenant_id());
create policy loyalty_tx_staff_select on public.loyalty_transactions
  for select to authenticated using (tenant_id = app.current_tenant_id());
create policy coupons_staff_all on public.coupons
  for all to authenticated
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

-- Orders gain discount/loyalty columns + coupon link.
alter table public.orders
  add column coupon_code text,
  add column discount int not null default 0 check (discount >= 0),
  add column loyalty_redeemed int not null default 0 check (loyalty_redeemed >= 0),
  add column loyalty_accrued int not null default 0 check (loyalty_accrued >= 0);
