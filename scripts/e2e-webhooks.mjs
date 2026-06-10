/**
 * E2E: webhook layer. Creates an endpoint via the API, listens locally,
 * fires a test delivery + a real order + a status change, verifies
 * signatures and delivery statuses. Exits 0 on full success.
 * Usage: node scripts/e2e-webhooks.mjs [baseUrl]
 */
import { createServer } from "http";
import { createHmac, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const BASE = process.argv[2] ?? "http://demo-a.localtest.me:3001";
const PORT = 4949;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const received = [];
let secret = null;

function verify(rawBody, header) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  if ((parts.v1 ?? "").length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}

const server = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const ok = verify(body, req.headers["x-platform-signature"] ?? "");
    const evt = req.headers["x-platform-event"];
    received.push({ evt, ok, body: JSON.parse(body) });
    console.log(`  [listener] ${evt} signature=${ok ? "VALID" : "INVALID"}`);
    res.writeHead(ok ? 200 : 401).end();
  });
});

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

async function main() {
  await new Promise((r) => server.listen(PORT, r));
  console.log(`listener on :${PORT}`);

  // Cleanup leftovers from previous runs (stale endpoints invalidate signatures)
  const adminPre = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: t0 } = await adminPre.from("tenants").select("id").eq("slug", "demo-a").single();
  await adminPre.from("webhook_endpoints").delete().eq("tenant_id", t0.id);
  console.log("cleaned stale endpoints");

  // Owner session
  const staff = createClient(url, anonKey);
  const { data: login, error: loginErr } = await staff.auth.signInWithPassword({
    email: "owner-a@demo.test",
    password: process.env.TEST_STAFF_PASSWORD,
  });
  if (loginErr) fail(`login: ${loginErr.message}`);
  const token = login.session.access_token;
  const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // 1. Create endpoint
  const epRes = await fetch(`${BASE}/api/webhooks`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      url: `http://localhost:${PORT}/hook`,
      events: ["order.created", "order.status_changed", "order.cancelled"],
    }),
  });
  const epData = await epRes.json();
  if (epRes.status !== 201) fail(`create endpoint: ${epRes.status} ${JSON.stringify(epData)}`);
  secret = epData.endpoint.secret;
  const endpointId = epData.endpoint.id;
  console.log(`endpoint created: ${endpointId} (secret received once: ${secret.slice(0, 12)}...)`);

  // 2. Test delivery
  const testRes = await fetch(`${BASE}/api/webhooks/test`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ endpoint_id: endpointId }),
  });
  const testData = await testRes.json();
  if (testData?.result?.status !== "delivered") fail(`test delivery: ${JSON.stringify(testData)}`);
  console.log(`test delivery: delivered (HTTP ${testData.result.last_status_code})`);

  // 3. Real order (item without required groups: צ'יפס from the real HB menu)
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: tenant } = await admin.from("tenants").select("id").eq("slug", "demo-a").single();
  // Pick any available item with no required option groups.
  const { data: candidates } = await admin
    .from("menu_items")
    .select("id, name")
    .eq("tenant_id", tenant.id)
    .eq("is_available", true)
    .limit(30);
  const { data: requiredGroups } = await admin
    .from("option_groups")
    .select("item_id")
    .eq("tenant_id", tenant.id)
    .eq("required", true);
  const requiredItemIds = new Set((requiredGroups ?? []).map((g) => g.item_id));
  const item = (candidates ?? []).find((i) => !requiredItemIds.has(i.id));
  if (!item) fail("no item without required groups found");
  console.log(`using item: ${item.name}`);

  const orderRes = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "pickup",
      customer_name: "בדיקת ובהוקים",
      customer_phone: "0509999999",
      lines: [{ itemId: item.id, qty: 3, selections: {} }],
    }),
  });
  const orderData = await orderRes.json();
  if (orderRes.status !== 201) fail(`order create: ${orderRes.status} ${JSON.stringify(orderData)}`);
  const orderId = orderData.order.id;
  console.log(`order created: #${orderData.order.number}`);

  // 4. Status change via staff RLS client, then tracking poll dispatches it
  const { error: upErr } = await staff
    .from("orders").update({ status: "preparing" }).eq("id", orderId);
  if (upErr) fail(`status update: ${upErr.message}`);
  await fetch(`${BASE}/api/orders/${orderId}`); // piggyback dispatcher
  await new Promise((r) => setTimeout(r, 1500));

  // 5. Assertions
  const created = received.find((r) => r.evt === "order.created" && !r.body.data.test);
  const statusChanged = received.find((r) => r.evt === "order.status_changed");
  if (!created) fail("order.created webhook not received");
  if (!created.ok) fail("order.created signature invalid");
  if (created.body.data.number !== orderData.order.number) fail("payload number mismatch");
  if (!statusChanged) fail("order.status_changed webhook not received");
  if (statusChanged.body.data.status !== "preparing") fail("status payload mismatch");
  if (statusChanged.body.data.previous_status !== "new") fail("previous_status mismatch");

  // 6. Cleanup: cancel order, remove endpoint (cancel fires order.cancelled too)
  await staff.from("orders").update({ status: "canceled" }).eq("id", orderId);
  await admin.from("webhook_endpoints").delete().eq("id", endpointId);
  await admin.from("orders").delete().eq("id", orderId);

  console.log("\nE2E WEBHOOKS: ALL PASS ✔");
  console.log(`deliveries received: ${received.length}, all signatures valid: ${received.every((r) => r.ok)}`);
  server.close();
  process.exit(0);
}

main().catch((e) => fail(e.message));
