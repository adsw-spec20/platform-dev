-- 0008: delivery zones, opening hours, operational status, image storage.

create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  price int not null default 0 check (price >= 0), -- agorot
  polygon jsonb not null, -- [[lat,lng], ...] ring
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.delivery_zones enable row level security;

create policy delivery_zones_staff_all on public.delivery_zones
  for all to authenticated
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

alter table public.tenant_settings
  add column opening_hours jsonb not null default '{
    "sunday": "10:00-22:00", "monday": "10:00-22:00", "tuesday": "10:00-22:00",
    "wednesday": "10:00-22:00", "thursday": "10:00-22:00",
    "friday": "10:00-15:00", "saturday": "closed"
  }'::jsonb,
  add column operational_status text not null default 'auto'
    check (operational_status in ('auto', 'busy', 'closed')),
  add column busy_extra_minutes int not null default 15;

-- Public storage bucket; staff may write only inside their tenant folder.
insert into storage.buckets (id, name, public)
values ('public-assets', 'public-assets', true)
on conflict (id) do nothing;

create policy "tenant folder write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'public-assets'
    and (storage.foldername(name))[1] = app.current_tenant_id()::text
  );

create policy "tenant folder update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'public-assets'
    and (storage.foldername(name))[1] = app.current_tenant_id()::text
  );

create policy "tenant folder delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'public-assets'
    and (storage.foldername(name))[1] = app.current_tenant_id()::text
  );

create policy "public read assets" on storage.objects
  for select to public
  using (bucket_id = 'public-assets');
