-- 0012: atomic loyalty ledger + coupon usage counters (service-role only).

create or replace function public.apply_loyalty(
  p_tenant_id uuid,
  p_phone text,
  p_order_id uuid,
  p_redeem int,
  p_accrue int,
  p_account_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  acc_id uuid := p_account_id;
begin
  if acc_id is null then
    insert into public.loyalty_accounts (tenant_id, phone)
    values (p_tenant_id, p_phone)
    on conflict (tenant_id, phone) do update set updated_at = now()
    returning id into acc_id;
  end if;

  if p_redeem > 0 then
    update public.loyalty_accounts
      set balance = balance - p_redeem, updated_at = now()
      where id = acc_id and balance >= p_redeem;
    if not found then
      raise exception 'insufficient_loyalty_balance';
    end if;
    insert into public.loyalty_transactions (tenant_id, account_id, order_id, kind, amount)
    values (p_tenant_id, acc_id, p_order_id, 'redemption', -p_redeem);
  end if;

  if p_accrue > 0 then
    update public.loyalty_accounts
      set balance = balance + p_accrue, updated_at = now()
      where id = acc_id;
    insert into public.loyalty_transactions (tenant_id, account_id, order_id, kind, amount)
    values (p_tenant_id, acc_id, p_order_id, 'accrual', p_accrue);
  end if;
end;
$$;

create or replace function public.increment_coupon_use(p_coupon_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.coupons set used_count = used_count + 1 where id = p_coupon_id;
$$;

revoke execute on function public.apply_loyalty(uuid, text, uuid, int, int, uuid) from public, anon, authenticated;
revoke execute on function public.increment_coupon_use(uuid) from public, anon, authenticated;
