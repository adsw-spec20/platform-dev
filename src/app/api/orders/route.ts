import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getFullMenu } from "@/lib/dal/tenant-data";
import { calcLinePrice, calcCartTotals, type Selections } from "@/lib/pricing";
import { validateSelections } from "@/lib/orders/validate";
import { isOpenNow } from "@/lib/hours";
import { quoteDelivery } from "@/lib/server/delivery";
import { normalizePhone, maxRedeemable } from "@/lib/loyalty";
import { processDueDeliveries } from "@/lib/webhooks/dispatch";

const LineSchema = z.object({
  itemId: z.string().uuid(),
  qty: z.number().int().min(1).max(50),
  selections: z.record(
    z.string(),
    z.array(z.object({ optionId: z.string(), qty: z.number().int().min(1).max(50) }))
  ),
  notes: z.string().max(500).optional(),
});

const OrderSchema = z.object({
  method: z.enum(["delivery", "pickup"]),
  customer_name: z.string().min(2).max(120),
  customer_phone: z.string().regex(/^0\d{8,9}$/),
  coupon_code: z.string().max(40).optional(),
  redeem_loyalty: z.boolean().optional(),
  address: z
    .object({
      street: z.string().min(1).max(200),
      house_number: z.string().min(1).max(20),
      city: z.string().min(1).max(100),
      apartment: z.string().max(20).optional(),
      floor: z.string().max(20).optional(),
    })
    .optional(),
  customer_notes: z.string().max(1000).optional(),
  lines: z.array(LineSchema).min(1).max(50),
});

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: Request) {
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  if (!tenantId) {
    return NextResponse.json({ error: { code: "no_tenant" } }, { status: 404 });
  }

  const parsed = OrderSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", details: parsed.error.flatten() } },
      { status: 422 }
    );
  }
  const body = parsed.data;

  if (body.method === "delivery" && !body.address) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "כתובת נדרשת למשלוח" } },
      { status: 422 }
    );
  }

  const client = db();
  const [{ data: settings }, menu] = await Promise.all([
    client.from("tenant_settings").select("*").eq("tenant_id", tenantId).maybeSingle(),
    getFullMenu(tenantId),
  ]);
  if (!settings) {
    return NextResponse.json({ error: { code: "no_settings" } }, { status: 409 });
  }
  // Operational guard: explicit close, or outside opening hours in auto mode.
  if (settings.operational_status === "closed") {
    return NextResponse.json(
      { error: { code: "closed", message: "המסעדה סגורה כרגע" } },
      { status: 409 }
    );
  }
  if (
    settings.operational_status === "auto" &&
    !isOpenNow(settings.opening_hours ?? {})
  ) {
    return NextResponse.json(
      { error: { code: "closed", message: "המסעדה סגורה כעת — בדקו את שעות הפתיחה" } },
      { status: 409 }
    );
  }
  if (body.method === "delivery" && !settings.delivery_enabled) {
    return NextResponse.json(
      { error: { code: "method_disabled", message: "משלוחים אינם זמינים כעת" } },
      { status: 409 }
    );
  }
  if (body.method === "pickup" && !settings.pickup_enabled) {
    return NextResponse.json(
      { error: { code: "method_disabled", message: "איסוף עצמי אינו זמין כעת" } },
      { status: 409 }
    );
  }

  const itemById = new Map(menu.flatMap((c) => c.items).map((i) => [i.id, i]));

  // Server-side pricing: recompute everything from DB state.
  const snapshotLines = [];
  for (const line of body.lines) {
    const item = itemById.get(line.itemId);
    if (!item || !item.is_available) {
      return NextResponse.json(
        { error: { code: "item_unavailable", itemId: line.itemId } },
        { status: 409 }
      );
    }
    const errs = validateSelections(item, line.selections as Selections);
    if (errs.length > 0) {
      return NextResponse.json(
        { error: { code: "invalid_selections", details: errs } },
        { status: 422 }
      );
    }
    const linePrice = calcLinePrice(item, line.selections as Selections, line.qty);

    snapshotLines.push({
      item_id: item.id,
      name: item.name,
      qty: line.qty,
      unit_price: item.price,
      line_price: linePrice,
      notes: line.notes ?? null,
      selections: item.option_groups
        .filter((g) => (line.selections[g.id] ?? []).length > 0)
        .map((g) => ({
          group_name: g.name,
          options: (line.selections[g.id] ?? []).map((s) => {
            const o = g.options.find((x) => x.id === s.optionId)!;
            return { name: o.name, qty: s.qty, price_delta: o.price_delta };
          }),
        })),
    });
  }

  // Delivery fee: polygon zone price when zones are defined, else flat fee.
  let deliveryFee = settings.delivery_fee;
  if (body.method === "delivery" && body.address) {
    const quote = await quoteDelivery(tenantId, body.address, settings.delivery_fee);
    if (!quote.ok) {
      const message =
        quote.reason === "outside_zones"
          ? "הכתובת מחוץ לאזורי המשלוח שלנו"
          : "לא הצלחנו לאתר את הכתובת — בדקו את הפרטים";
      return NextResponse.json(
        { error: { code: quote.reason, message } },
        { status: 409 }
      );
    }
    deliveryFee = quote.fee;
  }

  const totals = calcCartTotals(
    snapshotLines.map((l) => ({ linePrice: l.line_price })),
    { delivery_fee: deliveryFee, min_order: settings.min_order },
    body.method
  );

  // Coupon (server-validated)
  let discount = 0;
  let couponId: string | null = null;
  if (body.coupon_code) {
    const { data: coupon } = await client
      .from("coupons")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("code", body.coupon_code.trim().toUpperCase())
      .eq("is_active", true)
      .maybeSingle();
    const expired = coupon?.expires_at && new Date(coupon.expires_at) < new Date();
    const exhausted = coupon?.max_uses != null && coupon.used_count >= coupon.max_uses;
    if (!coupon || expired || exhausted || totals.subtotal < coupon.min_subtotal) {
      return NextResponse.json(
        { error: { code: "invalid_coupon", message: "קוד הקופון אינו תקף" } },
        { status: 409 }
      );
    }
    discount =
      coupon.kind === "percent"
        ? Math.round((totals.subtotal * coupon.value) / 100)
        : Math.min(coupon.value, totals.subtotal);
    couponId = coupon.id;
  }

  // Loyalty redemption (server-enforced, both modes)
  let redeemed = 0;
  let loyaltyAccountId: string | null = null;
  const phone = normalizePhone(body.customer_phone);
  if (settings.loyalty_enabled && body.redeem_loyalty && phone) {
    const { data: account } = await client
      .from("loyalty_accounts")
      .select("id, balance")
      .eq("tenant_id", tenantId)
      .eq("phone", phone)
      .maybeSingle();
    if (account && account.balance > 0) {
      const units = snapshotLines.map((l) => ({
        unitPrice: Math.round(l.line_price / l.qty),
        qty: l.qty,
      }));
      redeemed = maxRedeemable(
        settings.loyalty_redemption_mode,
        account.balance,
        units
      );
      redeemed = Math.min(redeemed, totals.subtotal - discount);
      loyaltyAccountId = account.id;
    }
  }

  if (totals.subtotal < settings.min_order) {
    return NextResponse.json(
      {
        error: {
          code: "below_minimum",
          message: `מינימום הזמנה: ₪${(settings.min_order / 100).toFixed(2)}`,
        },
      },
      { status: 409 }
    );
  }

  // Per-tenant sequential number (atomic upsert in DB function).
  const { data: bumped, error: bumpErr } = await client.rpc("next_order_number", {
    p_tenant_id: tenantId,
  });
  if (bumpErr || bumped == null) {
    return NextResponse.json({ error: { code: "counter_failed" } }, { status: 500 });
  }

  const { data: order, error: insertErr } = await client
    .from("orders")
    .insert({
      tenant_id: tenantId,
      number: bumped,
      method: body.method,
      payment_method: "cash",
      payment_status: "na",
      customer_name: body.customer_name,
      customer_phone: body.customer_phone,
      address: body.address ?? null,
      customer_notes: body.customer_notes ?? null,
      items: snapshotLines,
      subtotal: totals.subtotal,
      delivery_fee: deliveryFee,
      discount,
      loyalty_redeemed: redeemed,
      coupon_code: couponId ? body.coupon_code!.trim().toUpperCase() : null,
      total: totals.subtotal - discount - redeemed + (body.method === "delivery" ? deliveryFee : 0),
    })
    .select("id, number")
    .single();

  if (insertErr) {
    return NextResponse.json({ error: { code: "insert_failed" } }, { status: 500 });
  }

  // Post-insert side effects: coupon usage, loyalty ledger (accrual + redemption).
  if (couponId) {
    await client.rpc("increment_coupon_use", { p_coupon_id: couponId });
  }
  if (settings.loyalty_enabled && phone) {
    const accrual = Math.round(
      ((totals.subtotal - discount - redeemed) * settings.loyalty_accrual_percent) / 100
    );
    await client.rpc("apply_loyalty", {
      p_tenant_id: tenantId,
      p_phone: phone,
      p_order_id: order!.id,
      p_redeem: redeemed,
      p_accrue: accrual,
      p_account_id: loyaltyAccountId,
    });
    await client
      .from("orders")
      .update({ loyalty_accrued: accrual })
      .eq("id", order!.id);
  }

  // The DB trigger enqueued order.created deliveries; dispatch them now.
  await processDueDeliveries(5);

  return NextResponse.json({ order }, { status: 201 });
}
