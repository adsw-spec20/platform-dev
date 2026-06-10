-- 0005: order status state machine enforced at the DB level.
-- Invalid transitions raise an exception regardless of caller (RLS client,
-- service role, or future API) - the QuickFood "invalid_transition" lesson.

create or replace function app.enforce_order_transition()
returns trigger
language plpgsql
as $$
declare
  allowed text[];
begin
  if old.status = new.status then
    new.updated_at := now();
    return new;
  end if;

  allowed := case old.status
    when 'new' then array['preparing', 'canceled']
    when 'preparing' then array['ready', 'canceled']
    when 'ready' then array['out_for_delivery', 'completed', 'canceled']
    when 'out_for_delivery' then array['completed', 'canceled']
    else array[]::text[] -- completed / canceled are terminal
  end;

  if not (new.status = any(allowed)) then
    raise exception 'invalid_transition: % -> %', old.status, new.status
      using errcode = 'P0001';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger orders_status_transition
  before update on public.orders
  for each row
  execute function app.enforce_order_transition();
