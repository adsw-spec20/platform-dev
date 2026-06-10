/**
 * Imports the REAL Home Burger menu (exported read-only from base44)
 * into the demo-a tenant. Replaces demo-a's existing menu entirely.
 * This makes tenant-zero the living design-parity benchmark.
 *
 * HB schema -> platform schema mapping:
 *  - base_price / price_delta are SHEKELS (float) -> agorot (int, x100)
 *  - group.type: multi_choice->multi, single_choice->single,
 *    quantity_selector->quantity, text_input->text
 *  - price_calc {mode:'n_free_then_pay', n_free, price_per_extra} ->
 *    free_quantity=n_free; when price_mode='fixed_per_extra',
 *    every option's price_delta becomes price_per_extra (uniform),
 *    which makes our "free covers most expensive" math identical.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const toAgorot = (shekels: number | null | undefined) =>
  Math.round((shekels ?? 0) * 100);

type HbOption = {
  label: string;
  price_delta: number | null;
  default_selected: boolean | null;
  max_qty: number | null;
};
type HbGroup = {
  title: string;
  type: "multi_choice" | "single_choice" | "quantity_selector" | "text_input";
  required: boolean | null;
  min_selections: number | null;
  max_selections: number | null;
  options: HbOption[];
  price_calc: {
    mode: string;
    n_free?: number;
    price_mode?: string;
    price_per_extra?: number;
  } | null;
};
type HbItem = {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  category_id: string;
  image_url: string | null;
  sort_order: number | null;
  is_available: boolean;
  option_groups: HbGroup[] | null;
  badge_label: string | null;
  badge_color: string | null;
};
type HbCategory = {
  id: string;
  name: string;
  emoji: string;
  sort_order: number;
  is_available: boolean;
};

const TYPE_MAP: Record<HbGroup["type"], string> = {
  multi_choice: "multi",
  single_choice: "single",
  quantity_selector: "quantity",
  text_input: "text",
};

async function main() {
  const { data: tenant } = await admin
    .from("tenants").select("id").eq("slug", "demo-a").single();
  if (!tenant) throw new Error("demo-a tenant missing - run seed first");
  const tenantId = tenant.id;

  // Rebrand tenant-zero as the Home Burger demo + warm background.
  await admin.from("tenants").update({ name: "הום בורגר דמו" }).eq("id", tenantId);
  await admin
    .from("themes")
    .update({ background_color: "#FEF2F2", primary_color: "#DC2626", accent_color: "#F59E0B" })
    .eq("tenant_id", tenantId);

  // Wipe existing menu (cascades to items/groups/options).
  await admin.from("menu_categories").delete().eq("tenant_id", tenantId);
  console.log("wiped old demo-a menu");

  const cats: HbCategory[] = JSON.parse(
    readFileSync("data/hb-export/menu-categories.json", "utf8")
  ).entities;
  const items: HbItem[] = JSON.parse(
    readFileSync("data/hb-export/menu-items.json", "utf8")
  ).entities;

  const catIdMap = new Map<string, string>();
  for (const c of cats) {
    const { data, error } = await admin
      .from("menu_categories")
      .insert({
        tenant_id: tenantId,
        name: `${c.emoji} ${c.name}`,
        sort_order: c.sort_order,
        is_available: c.is_available,
      })
      .select("id").single();
    if (error) throw error;
    catIdMap.set(c.id, data.id);
  }
  console.log(`inserted ${catIdMap.size} categories`);

  let itemCount = 0;
  const itemIdMap = new Map<string, string>(); // HB id -> platform id
  for (const it of items) {
    const categoryId = catIdMap.get(it.category_id);
    if (!categoryId) {
      console.warn(`  skipping ${it.name} - unknown category`);
      continue;
    }
    const { data: row, error } = await admin
      .from("menu_items")
      .insert({
        tenant_id: tenantId,
        category_id: categoryId,
        name: it.name,
        description: it.description,
        price: toAgorot(it.base_price),
        image_url: it.image_url,
        sort_order: it.sort_order ?? 0,
        is_available: it.is_available,
        badge_label: it.badge_label,
        badge_color: it.badge_color,
      })
      .select("id").single();
    if (error) throw error;
    itemIdMap.set(it.id, row.id);
    itemCount++;

    for (const [gi, g] of (it.option_groups ?? []).entries()) {
      if (g.type === "text_input") continue; // notes field covers this in our model
      const isNFree = g.price_calc?.mode === "n_free_then_pay";
      const perExtra =
        isNFree && g.price_calc?.price_mode === "fixed_per_extra"
          ? toAgorot(g.price_calc?.price_per_extra)
          : null;

      const { data: group, error: ge } = await admin
        .from("option_groups")
        .insert({
          tenant_id: tenantId,
          item_id: row.id,
          name: g.title,
          type: TYPE_MAP[g.type],
          required: g.required ?? false,
          min_select: g.min_selections ?? 0,
          max_select: g.max_selections,
          free_quantity: isNFree ? (g.price_calc?.n_free ?? 0) : 0,
          sort_order: gi,
        })
        .select("id").single();
      if (ge) throw ge;

      const optionRows = (g.options ?? []).map((o, oi) => ({
        tenant_id: tenantId,
        group_id: group.id,
        name: o.label,
        price_delta: perExtra ?? toAgorot(o.price_delta),
        max_qty: o.max_qty,
        is_default: o.default_selected ?? false,
        sort_order: oi,
      }));
      if (optionRows.length > 0) {
        const { error: oe } = await admin.from("options").insert(optionRows);
        if (oe) throw oe;
      }
    }
  }
  console.log(`inserted ${itemCount} items with full option groups`);

  // Second pass: related items (upsell carousel data).
  let relatedCount = 0;
  for (const it of items) {
    const ids = (it as unknown as { related_item_ids?: string[] }).related_item_ids ?? [];
    const mapped = ids.map((x) => itemIdMap.get(x)).filter(Boolean) as string[];
    if (mapped.length === 0) continue;
    const newId = itemIdMap.get(it.id);
    if (!newId) continue;
    await admin.from("menu_items").update({ related_item_ids: mapped }).eq("id", newId);
    relatedCount++;
  }
  console.log(`linked related items on ${relatedCount} items`);
  console.log("Home Burger demo import complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
