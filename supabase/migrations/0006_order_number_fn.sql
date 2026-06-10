-- 0006: atomic per-tenant order number allocation.
create or replace function public.next_order_number(p_tenant_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  insert into public.order_counters (tenant_id, last_number)
  values (p_tenant_id, 1)
  on conflict (tenant_id)
  do update set last_number = public.order_counters.last_number + 1
  returning last_number into n;
  return n;
end;
$$;

-- Service-role/API use only.
revoke execute on function public.next_order_number(uuid) from public, anon, authenticated;
