/**
 * E2E: M8 — Wolt import into a freshly-provisioned tenant, end to end:
 * signup -> preview -> commit -> storefront renders imported menu.
 * Usage: node scripts/e2e-m8.mjs [rootBase] [woltUrl]
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const ROOT = process.argv[2] ?? "http://localhost:3000";
const WOLT = process.argv[3] ?? "https://wolt.com/en/isr/tel-aviv/restaurant/puzzle-burger";
const SLUG = `e2e-wolt-${Math.floor(Math.random() * 100000)}`;
const EMAIL = `owner-${SLUG}@e2e.test`;
const tenantBase = `http://${SLUG}.localtest.me:3000`;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

let failures = 0;
const check = (label, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}: ${label}${detail ? ` (${detail})` : ""}`);
  if (!cond) failures++;
};

async function main() {
  // Provision a fresh tenant via signup API
  const su = await fetch(`${ROOT}/api/signup`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      business_name: "בדיקת וולט", slug: SLUG, email: EMAIL,
      password: "TestPass!2026", seed_sample_menu: false,
    }),
  });
  check("tenant provisioned", su.status === 201);

  const owner = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: login } = await owner.auth.signInWithPassword({ email: EMAIL, password: "TestPass!2026" });
  const tok = login.session.access_token;
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${tok}` };

  // Preview
  const prev = await fetch(`${tenantBase}/api/wolt-import`, {
    method: "POST", headers, body: JSON.stringify({ url: WOLT, mode: "preview" }),
  });
  const prevData = await prev.json();
  check("preview returns items", prev.ok && prevData.preview?.item_count > 10,
    `items=${prevData.preview?.item_count}, cats=${prevData.preview?.categories?.length}`);
  check("preview has option groups", prevData.preview?.group_count > 0,
    `groups=${prevData.preview?.group_count}`);

  // Commit
  const com = await fetch(`${tenantBase}/api/wolt-import`, {
    method: "POST", headers, body: JSON.stringify({ url: WOLT, mode: "commit" }),
  });
  const comData = await com.json();
  check("commit imported", com.ok && comData.imported?.items > 10, JSON.stringify(comData.imported));

  // DB sanity: prices are positive ints, groups have options
  const { data: tenant } = await admin.from("tenants").select("id").eq("slug", SLUG).single();
  const { data: items } = await admin.from("menu_items").select("price").eq("tenant_id", tenant.id);
  check("all prices positive integers", items.every((i) => Number.isInteger(i.price) && i.price > 0),
    `${items.length} items`);
  const { count: optCount } = await admin
    .from("options").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id);
  check("options imported", (optCount ?? 0) > 0, `${optCount} options`);

  // Storefront renders an imported item name
  const { data: firstItem } = await admin
    .from("menu_items").select("name").eq("tenant_id", tenant.id).limit(1).single();
  const html = await fetch(tenantBase).then((r) => r.text());
  check("storefront renders imported menu", html.includes(firstItem.name.slice(0, 12)),
    firstItem.name);
  check("storefront shows wolt CDN images", html.includes("wolt.com"));

  // Cleanup
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const u = users.users.find((x) => x.email === EMAIL);
  if (u) await admin.auth.admin.deleteUser(u.id);
  await admin.from("tenants").delete().eq("id", tenant.id);
  console.log("cleaned up");

  console.log(failures === 0 ? "\nE2E M8 (WOLT IMPORT): ALL PASS ✔" : `\nE2E M8: ${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
