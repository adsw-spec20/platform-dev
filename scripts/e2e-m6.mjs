/**
 * E2E: M6 — coupons, loyalty (both modes), upsell, reorder mapping.
 * Usage: node scripts/e2e-m6.mjs <baseUrl>
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const BASE = process.argv[2] ?? "http://demo-a.localtest.me:3001";
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const PHONE = "0507777777";
let failures = 0;
const check = (label, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}: ${label}${detail ? ` (${detail})` : ""}`);
  if (!cond) failures++;
};

async function pickItem(maxPrice = Infinity) {
  const { data: tenant } = await admin.from("tenants").select("id").eq("slug", "demo-a").single();
  let q = admin
    .from("menu_items").select("id, name, price")
    .eq("tenant_id", tenant.id).eq("is_available", true)
    .order("price", { ascending: false }).limit(40);
  if (Number.isFinite(maxPrice)) q = q.lte("price", maxPrice);
  const { data: items } = await q;
  const { data: req } = await admin
    .from("option_groups").select("item_id").eq("tenant_id", tenant.id).eq("required", true);
  const blocked = new Set((req ?? []).map((g) => g.item_id));
  return { tenantId: tenant.id, items: (items ?? []).filter((i) => !blocked.has(i.id)) };
}

async function placeOrder(item, opts = {}) {
  const res = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "pickup",
      customer_name: "בדיקת מועדון",
      customer_phone: PHONE,
      lines: [{ itemId: item.id, qty: opts.qty ?? 1, selections: {} }],
      ...opts.body,
    }),
  });
  return { status: res.status, data: await res.json() };
}

async function main() {
  const { tenantId, items } = await pickItem();
  if (items.length < 2) { console.error("need 2+ quick-add items"); process.exit(1); }
  const item = items[0];

  // Clean slate
  await admin.from("loyalty_accounts").delete().eq("tenant_id", tenantId).eq("phone", PHONE);
  await admin.from("coupons").delete().eq("tenant_id", tenantId).eq("code", "E2E10");

  // Enable loyalty 10% free mode + create coupon 10%
  await admin.from("tenant_settings").update({
    loyalty_enabled: true, loyalty_accrual_percent: 10,
    loyalty_redemption_mode: "free_redemption",
  }).eq("tenant_id", tenantId);
  await admin.from("coupons").insert({
    tenant_id: tenantId, code: "E2E10", kind: "percent", value: 10,
  });

  // 1. Coupon preview API
  const prev = await fetch(`${BASE}/api/coupon`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: "e2e10", subtotal: 10000 }),
  });
  const prevData = await prev.json();
  check("coupon preview 10% of 100 = 10", prevData.discount === 1000, JSON.stringify(prevData));

  // 2. Order with coupon -> discount + accrual of 10% of (subtotal-discount)
  const o1 = await placeOrder(item, { body: { coupon_code: "E2E10" } });
  check("order with coupon created", o1.status === 201, JSON.stringify(o1.data).slice(0, 120));
  const { data: row1 } = await admin.from("orders")
    .select("subtotal, discount, total, loyalty_accrued").eq("id", o1.data.order.id).single();
  const expDiscount = Math.round(row1.subtotal * 0.1);
  check("discount = 10% of subtotal", row1.discount === expDiscount, `${row1.discount}/${expDiscount}`);
  check("total = subtotal - discount", row1.total === row1.subtotal - row1.discount);
  const expAccrual = Math.round((row1.subtotal - row1.discount) * 0.1);
  check("accrual = 10% after discount", row1.loyalty_accrued === expAccrual, `${row1.loyalty_accrued}/${expAccrual}`);

  const { data: acc1 } = await admin.from("loyalty_accounts")
    .select("balance").eq("tenant_id", tenantId).eq("phone", PHONE).single();
  check("balance equals accrual", acc1.balance === expAccrual);

  // 3. Loyalty status API
  const loy = await fetch(`${BASE}/api/loyalty?phone=${PHONE}`).then((r) => r.json());
  check("loyalty API returns balance", loy.enabled === true && loy.balance === acc1.balance);

  // 4. FREE mode redemption: order again redeeming points
  const o2 = await placeOrder(item, { body: { redeem_loyalty: true } });
  const { data: row2 } = await admin.from("orders")
    .select("subtotal, loyalty_redeemed, total").eq("id", o2.data.order.id).single();
  check("free-mode redeemed = min(balance, subtotal)",
    row2.loyalty_redeemed === Math.min(acc1.balance, row2.subtotal),
    `redeemed ${row2.loyalty_redeemed}`);
  check("total reflects redemption", row2.total === row2.subtotal - row2.loyalty_redeemed);

  // 5. FULL-ITEM mode: set balance to cover cheapest item exactly +5, switch mode
  const cheap = items[items.length - 1];
  const expensive = items[0];
  await admin.from("tenant_settings")
    .update({ loyalty_redemption_mode: "full_item_redemption" }).eq("tenant_id", tenantId);
  const { data: accRow } = await admin.from("loyalty_accounts")
    .select("id").eq("tenant_id", tenantId).eq("phone", PHONE).single();
  await admin.from("loyalty_accounts").update({ balance: cheap.price + 500 }).eq("id", accRow.id);

  // Order with BOTH items; balance covers only the cheap one fully
  const o3res = await fetch(`${BASE}/api/orders`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "pickup", customer_name: "בדיקת מועדון", customer_phone: PHONE,
      redeem_loyalty: true,
      lines: [
        { itemId: expensive.id, qty: 1, selections: {} },
        { itemId: cheap.id, qty: 1, selections: {} },
      ],
    }),
  });
  const o3 = await o3res.json();
  const { data: row3 } = await admin.from("orders")
    .select("loyalty_redeemed").eq("id", o3.order.id).single();
  check("full-item mode redeems exactly the fully-covered item",
    row3.loyalty_redeemed === cheap.price,
    `redeemed ${row3.loyalty_redeemed}, cheap item ${cheap.price}, expensive ${expensive.price}`);

  // 6. Upsell API
  const up = await fetch(`${BASE}/api/upsell?items=${expensive.id}`).then((r) => r.json());
  check("upsell returns related items array", Array.isArray(up.items), `${up.items?.length} items`);

  // 7. Reorder mapping
  const re = await fetch(`${BASE}/api/reorder/${o1.data.order.id}`).then((r) => r.json());
  check("reorder maps lines from snapshot", re.lines?.length === 1 && re.lines[0].item.id === item.id);

  // Cleanup
  for (const id of [o1.data.order.id, o2.data.order.id, o3.order.id]) {
    await admin.from("orders").delete().eq("id", id);
  }
  await admin.from("coupons").delete().eq("tenant_id", tenantId).eq("code", "E2E10");
  await admin.from("loyalty_accounts").delete().eq("tenant_id", tenantId).eq("phone", PHONE);
  await admin.from("tenant_settings").update({ loyalty_enabled: false }).eq("tenant_id", tenantId);

  console.log(failures === 0 ? "\nE2E M6: ALL PASS ✔" : `\nE2E M6: ${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
