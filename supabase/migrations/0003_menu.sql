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
