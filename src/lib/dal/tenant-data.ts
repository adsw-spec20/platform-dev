/**
 * Server-side data access layer for storefront reads.
 * RULE: service role + EXPLICIT tenant_id scoping on every query.
 * Never import this from client components.
 */
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type {
  MenuCategory,
  MenuItem,
  OptionGroup,
  TenantContext,
} from "@/lib/types";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function getTenantContext(
  tenantId: string
): Promise<TenantContext | null> {
  const client = db();
  const [{ data: tenant }, { data: theme }] = await Promise.all([
    client.from("tenants").select("*").eq("id", tenantId).maybeSingle(),
    client.from("themes").select("*").eq("tenant_id", tenantId).maybeSingle(),
  ]);
  if (!tenant || !theme) return null;
  return { tenant, theme };
}

/** Full menu tree for one tenant: categories -> items -> option groups -> options. */
export async function getFullMenu(tenantId: string): Promise<MenuCategory[]> {
  const client = db();
  const [cats, items, groups, options] = await Promise.all([
    client
      .from("menu_categories")
      .select("id, name, sort_order")
      .eq("tenant_id", tenantId)
      .eq("is_available", true)
      .order("sort_order"),
    client
      .from("menu_items")
      .select(
        "id, category_id, name, description, price, image_url, sort_order, is_available, badge_label, badge_color"
      )
      .eq("tenant_id", tenantId)
      .order("sort_order"),
    client
      .from("option_groups")
      .select(
        "id, item_id, name, type, required, min_select, max_select, free_quantity, sort_order"
      )
      .eq("tenant_id", tenantId)
      .order("sort_order"),
    client
      .from("options")
      .select(
        "id, group_id, name, price_delta, max_qty, is_default, sort_order"
      )
      .eq("tenant_id", tenantId)
      .order("sort_order"),
  ]);

  const optionsByGroup = new Map<string, NonNullable<typeof options.data>>();
  for (const o of options.data ?? []) {
    const arr = optionsByGroup.get(o.group_id) ?? [];
    arr.push(o);
    optionsByGroup.set(o.group_id, arr);
  }

  const groupsByItem = new Map<string, OptionGroup[]>();
  for (const g of groups.data ?? []) {
    const arr = groupsByItem.get(g.item_id) ?? [];
    arr.push({ ...g, options: optionsByGroup.get(g.id) ?? [] });
    groupsByItem.set(g.item_id, arr);
  }

  const itemsByCategory = new Map<string, MenuItem[]>();
  for (const i of items.data ?? []) {
    const arr = itemsByCategory.get(i.category_id) ?? [];
    arr.push({ ...i, option_groups: groupsByItem.get(i.id) ?? [] });
    itemsByCategory.set(i.category_id, arr);
  }

  return (cats.data ?? []).map((c) => ({
    ...c,
    items: itemsByCategory.get(c.id) ?? [],
  }));
}
