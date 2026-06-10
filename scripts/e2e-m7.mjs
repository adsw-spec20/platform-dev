/**
 * E2E: M7 — self-service signup, provisioning completeness, suspend/activate,
 * super-admin API. Usage: node scripts/e2e-m7.mjs [rootBase] [tenantBaseTemplate]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { config } from "dotenv";
config({ path: ".env.local" });

const ROOT = process.argv[2] ?? "http://localhost:3000";
const SLUG = `e2e-biz-${Math.floor(Math.random() * 100000)}`;
const tenantBase = `http://${SLUG}.localtest.me:3000`;
const EMAIL = `owner-${SLUG}@e2e.test`;

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
  // 1. Slug availability
  const avail = await fetch(`${ROOT}/api/signup?slug=${SLUG}`).then((r) => r.json());
  check("slug reported available", avail.available === true);

  // 2. Honeypot silently ignored
  const hp = await fetch(`${ROOT}/api/signup`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      business_name: "בוט", slug: "bot-trap-xyz", email: "bot@bot.test",
      password: "password123", website: "x",
    }),
  });
  check("honeypot returns 422 (website must be empty)", hp.status === 422);

  // 3. Real signup
  const res = await fetch(`${ROOT}/api/signup`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      business_name: "מסעדת בדיקה E2E",
      slug: SLUG,
      email: EMAIL,
      password: "TestPass!2026",
      primary_color: "#2563EB",
      seed_sample_menu: true,
    }),
  });
  const data = await res.json();
  check("signup 201", res.status === 201, JSON.stringify(data));

  // 4. Provisioning completeness
  const { data: tenant } = await admin.from("tenants").select("*").eq("slug", SLUG).single();
  check("tenant exists (trial)", tenant?.status === "trial");
  const tid = tenant.id;
  const [{ data: theme }, { data: settings }, { data: counter }, { data: role }] = await Promise.all([
    admin.from("themes").select("primary_color").eq("tenant_id", tid).maybeSingle(),
    admin.from("tenant_settings").select("tenant_id").eq("tenant_id", tid).maybeSingle(),
    admin.from("order_counters").select("tenant_id").eq("tenant_id", tid).maybeSingle(),
    admin.from("roles").select("key").eq("tenant_id", tid).eq("key", "owner").maybeSingle(),
  ]);
  check("theme with chosen color", theme?.primary_color === "#2563EB");
  check("settings row", !!settings);
  check("order counter", !!counter);
  check("owner role", !!role);

  // 5. Storefront live with sample menu
  const html = await fetch(tenantBase).then((r) => r.text());
  check("storefront renders business name", html.includes("מסעדת בדיקה E2E"));
  check("storefront shows sample item", html.includes("מנה לדוגמה"));
  check("storefront uses chosen color", html.includes("#2563EB"));

  // 6. Owner can sign in
  const ownerClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: login, error: loginErr } = await ownerClient.auth.signInWithPassword({
    email: EMAIL, password: "TestPass!2026",
  });
  check("owner signs in", !loginErr && !!login.session);
  check("owner JWT carries tenant_id", login?.session?.user?.app_metadata?.tenant_id === tid);

  // 7. Super-admin API: list includes new tenant; suspend it
  const creds = readFileSync(".admin-credentials.txt", "utf8");
  const adminPass = creds.match(/password: (.+)/)[1].trim();
  const adminClient2 = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: adminLogin, error: adminErr } = await adminClient2.auth.signInWithPassword({
    email: "zbangush@gmail.com", password: adminPass,
  });
  check("super admin signs in", !adminErr, adminErr?.message);
  const adminTok = adminLogin?.session?.access_token;

  const list = await fetch(`${ROOT}/api/admin/tenants`, {
    headers: { Authorization: `Bearer ${adminTok}` },
  }).then((r) => r.json());
  check("admin list includes new tenant", list.tenants?.some((t) => t.slug === SLUG));

  const forbidden = await fetch(`${ROOT}/api/admin/tenants`, {
    headers: { Authorization: `Bearer ${login.session.access_token}` },
  });
  check("regular owner forbidden from admin API", forbidden.status === 403);

  await fetch(`${ROOT}/api/admin/tenants`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminTok}` },
    body: JSON.stringify({ tenant_id: tid, status: "suspended" }),
  });
  const suspendedHtml = await fetch(tenantBase).then((r) => r.text());
  check("suspended store shows סגור זמנית", suspendedHtml.includes("סגור זמנית"));

  await fetch(`${ROOT}/api/admin/tenants`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminTok}` },
    body: JSON.stringify({ tenant_id: tid, status: "active" }),
  });
  const backHtml = await fetch(tenantBase).then((r) => r.text());
  check("reactivated store serves menu again", backHtml.includes("מנה לדוגמה"));

  // Cleanup
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const owner = users.users.find((u) => u.email === EMAIL);
  if (owner) await admin.auth.admin.deleteUser(owner.id);
  await admin.from("tenants").delete().eq("id", tid);
  console.log("cleaned up test tenant");

  console.log(failures === 0 ? "\nE2E M7: ALL PASS ✔" : `\nE2E M7: ${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
