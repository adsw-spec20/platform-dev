-- 0013: super-admin aggregates.
create or replace function public.tenant_order_counts()
returns table (tenant_id uuid, orders bigint)
language sql
security definer
set search_path = public
as $$
  select o.tenant_id, count(*) as orders
  from public.orders o
  group by o.tenant_id;
$$;

revoke execute on function public.tenant_order_counts() from public, anon, authenticated;
