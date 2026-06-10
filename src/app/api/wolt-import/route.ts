import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff, hasPermission, adminDb } from "@/lib/server/auth";
import { fetchWoltMenu } from "@/lib/server/wolt";

const Schema = z.object({
  url: z.string().url().max(500),
  mode: z.enum(["preview", "commit"]),
});

/** Wolt menu import. preview = mapped summary; commit = REPLACES the menu. */
export async function POST(req: Request) {
  const ctx = await requireStaff(req);
  if (!ctx || !(hasPermission(ctx, "manage_menu") || ctx.roleKey === "owner")) {
    return NextResponse.json({ error: { code: "forbidden" } }, { status: 403 });
  }
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "validation_error" } }, { status: 422 });
  }

  const menu = await fetchWoltMenu(parsed.data.url);
  if ("error" in menu) {
    return NextResponse.json({ error: { code: "wolt_fetch_failed", message: menu.error } }, { status: 409 });
  }

  const itemCount = menu.categories.reduce((s, c) => s + c.items.length, 0);
  const groupCount = menu.categories.reduce(
    (s, c) => s + c.items.reduce((x, i) => x + i.groups.length, 0), 0
  );

  if (parsed.data.mode === "preview") {
    return NextResponse.json({
      preview: {
        venue_slug: menu.venue_slug,
        categories: menu.categories.map((c) => ({ name: c.name, items: c.items.length })),
        item_count: itemCount,
        group_count: groupCount,
        warnings: menu.warnings,
        sample: menu.categories[0]?.items.slice(0, 3).map((i) => ({
          name: i.name, price: i.price, groups: i.groups.length, has_image: !!i.image_url,
        })),
      },
    });
  }

  // COMMIT: replace the tenant's menu wholesale.
  const admin = adminDb();
  const tenantId = ctx.tenantId;
  await admin.from("menu_categories").delete().eq("tenant_id", tenantId);

  for (const [ci, cat] of menu.categories.entries()) {
    const { data: catRow, error: ce } = await admin
      .from("menu_categories")
      .insert({ tenant_id: tenantId, name: cat.name, sort_order: ci })
      .select("id").single();
    if (ce || !catRow) {
      return NextResponse.json({ error: { code: "import_failed", at: cat.name } }, { status: 500 });
    }
    for (const [ii, item] of cat.items.entries()) {
      const { data: itemRow, error: ie } = await admin
        .from("menu_items")
        .insert({
          tenant_id: tenantId,
          category_id: catRow.id,
          name: item.name,
          description: item.description,
          price: item.price,
          image_url: item.image_url,
          sort_order: ii,
        })
        .select("id").single();
      if (ie || !itemRow) continue;
      for (const [gi, g] of item.groups.entries()) {
        const { data: groupRow } = await admin
          .from("option_groups")
          .insert({
            tenant_id: tenantId,
            item_id: itemRow.id,
            name: g.name,
            type: g.type,
            required: g.required,
            min_select: g.min_select,
            max_select: g.max_select,
            free_quantity: g.free_quantity,
            sort_order: gi,
          })
          .select("id").single();
        if (!groupRow) continue;
        if (g.options.length > 0) {
          await admin.from("options").insert(
            g.options.map((o, oi) => ({
              tenant_id: tenantId,
              group_id: groupRow.id,
              name: o.name,
              price_delta: o.price_delta,
              sort_order: oi,
            }))
          );
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    imported: { categories: menu.categories.length, items: itemCount, groups: groupCount },
    warnings: menu.warnings,
  });
}
