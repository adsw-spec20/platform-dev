-- 0010: order events enqueue webhook deliveries at the DB level,
-- so EVERY write path (API, dashboard RLS update) emits events.
-- Dispatch/signing happens in the app (sweep + piggyback).

create or replace function app.enqueue_order_webhooks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  evt text;
  payload jsonb;
begin
  if tg_op = 'INSERT' then
    evt := 'order.created';
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    evt := case when new.status = 'canceled' then 'order.cancelled'
                else 'order.status_changed' end;
  else
    return new;
  end if;

  payload := jsonb_build_object(
    'order_id', new.id,
    'number', new.number,
    'status', new.status,
    'previous_status', case when tg_op = 'UPDATE' then old.status else null end,
    'method', new.method,
    'payment_method', new.payment_method,
    'customer_name', new.customer_name,
    'customer_phone', new.customer_phone,
    'address', new.address,
    'customer_notes', new.customer_notes,
    'items', new.items,
    'subtotal', new.subtotal,
    'delivery_fee', new.delivery_fee,
    'total', new.total,
    'created_at', new.created_at
  );

  insert into public.webhook_deliveries (tenant_id, endpoint_id, event, payload)
  select new.tenant_id, e.id, evt, payload
  from public.webhook_endpoints e
  where e.tenant_id = new.tenant_id
    and e.is_active
    and evt = any(e.events);

  return new;
end;
$$;

create trigger orders_webhooks_insert
  after insert on public.orders
  for each row execute function app.enqueue_order_webhooks();

create trigger orders_webhooks_update
  after update on public.orders
  for each row execute function app.enqueue_order_webhooks();
