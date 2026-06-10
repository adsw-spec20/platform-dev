/**
 * Seeds two demo tenants for development and isolation tests.
 * Idempotent: safe to run repeatedly (upserts by slug/email).
 * Uses service role - run locally only, never ship to client code.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const staffPassword = process.env.TEST_STAFF_PASSWORD!;
if (!url || !serviceKey || !staffPassword) throw new Error("Missing env vars");

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

type MenuSeed = {
  category: string;
  items: {
    name: string;
    price: number; // agorot
    groups?: {
      name: string;
      type: "single" | "multi";
      required?: boolean;
      free_quantity?: number;
      max_select?: number;
      options: { name: string; price_delta?: number }[];
    }[];
  }[];
}[];

const TENANTS: {
  slug: string;
  name: string;
  ownerEmail: string;
  menu: MenuSeed;
}[] = [
  {
    slug: "demo-a",
    name: "דמו בורגרים",
    ownerEmail: "owner-a@demo.test",
    menu: [
      {
        category: "בורגרים",
        items: [
          {
            name: "המבורגר קלאסי",
            price: 5500,
            groups: [
              {
                name: "מידת עשייה",
                type: "single",
                required: true,
                options: [{ name: "מדיום" }, { name: "וול דאן" }],
              },
              {
                name: "תוספות לבורגר",
                type: "multi",
                free_quantity: 2,
                max_select: 5,
                options: [
                  { name: "חסה", price_delta: 400 },
                  { name: "עגבנייה", price_delta: 400 },
                  { name: "בצל מקורמל", price_delta: 400 },
                  { name: "ביצת עין", price_delta: 600 },
                  { name: "צ'דר", price_delta: 600 },
                ],
              },
            ],
          },
          { name: "צ'יזבורגר כפול", price: 7200 },
        ],
      },
      {
        category: "תוספות",
        items: [
          { name: "צ'יפס", price: 1800 },
          { name: "טבעות בצל", price: 2200 },
        ],
      },
    ],
  },
  {
    slug: "demo-b",
    name: "דמו פיצה",
    ownerEmail: "owner-b@demo.test",
    menu: [
      {
        category: "פיצות",
        items: [
          {
            name: "מרגריטה",
            price: 5800,
            groups: [
              {
                name: "גודל",
                type: "single",
                required: true,
                options: [
                  { name: "אישית" },
                  { name: "משפחתית", price_delta: 1700 },
                ],
              },
              {
                name: "תוספות",
                type: "multi",
                max_select: 5,
                options: [
                  { name: "זיתים", price_delta: 500 },
                  { name: "פטריות", price_delta: 500 },
                  { name: "בצל", price_delta: 400 },
                ],
              },
            ],
          },
        ],
      },
      {
        category: "שתייה",
        items: [{ name: "קולה", price: 1200 }],
      },
    ],
  },
];

async function upsertTenant(slug: string, name: string): Promise<string> {
  const { data: existing } = await admin
    .from("tenants").select("id").eq("slug", slug).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await admin
    .from("tenants").insert({ slug, name }).select("id").single();
  if (error) throw error;
  await admin.from("themes").insert({ tenant_id: data.id });
  return data.id;
}

async function upsertOwner(email: string, tenantId: string): Promise<string> {
  const created = await admin.auth.admin.createUser({
    email,
    password: staffPassword,
    email_confirm: true,
    app_metadata: { tenant_id: tenantId },
  });
  if (created.data.user) return created.data.user.id;
  // Already exists: find and re-stamp tenant claim.
  const { data: list, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const user = list.users.find((u) => u.email === email);
  if (!user) throw new Error(`Cannot create or find user ${email}`);
  await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { tenant_id: tenantId },
  });
  return user.id;
}

async function upsertOwnerRole(tenantId: string): Promise<string> {
  const { data: existing } = await admin
    .from("roles").select("id")
    .eq("tenant_id", tenantId).eq("key", "owner").maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await admin
    .from("roles")
    .insert({
      tenant_id: tenantId,
      key: "owner",
      name: "בעלים",
      permissions: ["*"],
    })
    .select("id").single();
  if (error) throw error;
  return data.id;
}

async function seedMenu(tenantId: string, menu: MenuSeed) {
  const { count } = await admin
    .from("menu_categories")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if ((count ?? 0) > 0) {
    console.log(`  menu already seeded for ${tenantId}, skipping`);
    return;
  }
  for (const [ci, cat] of menu.entries()) {
    const { data: category, error: ce } = await admin
      .from("menu_categories")
      .insert({ tenant_id: tenantId, name: cat.category, sort_order: ci })
      .select("id").single();
    if (ce) throw ce;
    for (const [ii, item] of cat.items.entries()) {
      const { data: row, error: ie } = await admin
        .from("menu_items")
        .insert({
          tenant_id: tenantId,
          category_id: category.id,
          name: item.name,
          price: item.price,
          sort_order: ii,
        })
        .select("id").single();
      if (ie) throw ie;
      for (const [gi, g] of (item.groups ?? []).entries()) {
        const { data: group, error: ge } = await admin
          .from("option_groups")
          .insert({
            tenant_id: tenantId,
            item_id: row.id,
            name: g.name,
            type: g.type,
            required: g.required ?? false,
            free_quantity: g.free_quantity ?? 0,
            max_select: g.max_select ?? null,
            sort_order: gi,
          })
          .select("id").single();
        if (ge) throw ge;
        for (const [oi, o] of g.options.entries()) {
          const { error: oe } = await admin.from("options").insert({
            tenant_id: tenantId,
            group_id: group.id,
            name: o.name,
            price_delta: o.price_delta ?? 0,
            sort_order: oi,
          });
          if (oe) throw oe;
        }
      }
    }
  }
}

async function main() {
  for (const t of TENANTS) {
    console.log(`Seeding ${t.slug}...`);
    const tenantId = await upsertTenant(t.slug, t.name);
    const roleId = await upsertOwnerRole(tenantId);
    const userId = await upsertOwner(t.ownerEmail, tenantId);
    const { error } = await admin
      .from("staff_members")
      .upsert(
        { tenant_id: tenantId, user_id: userId, role_id: roleId },
        { onConflict: "tenant_id,user_id" }
      );
    if (error) throw error;
    await seedMenu(tenantId, t.menu);
    await admin.from("tenant_settings").upsert(
      { tenant_id: tenantId, delivery_fee: 1500, min_order: 5000 },
      { onConflict: "tenant_id" }
    );
    await admin.from("order_counters").upsert(
      { tenant_id: tenantId },
      { onConflict: "tenant_id", ignoreDuplicates: true }
    );
    console.log(`  done: tenant=${tenantId}`);
  }
  console.log("Seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
