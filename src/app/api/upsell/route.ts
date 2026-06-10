import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server/auth";

/** Related items for the cart ("שדרוג עגלה"). Only quick-addable items
 *  (no required option groups), excluding what's already in the cart. */
export async function GET(req: Request) {
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: { code: "no_tenant" } }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const inCart = (searchParams.get("items") ?? "")
    .split(",")
    .filter((s) => /^[0-9a-f-]{36}$/.test(s));
  if (inCart.length === 0) return NextResponse.json({ items: [] });

  const admin = adminDb();
  const { data: cartItems } = await admin
    .from("menu_items")
    .select("related_item_ids")
    .eq("tenant_id", tenantId)
    .in("id", inCart);

  const relatedIds = [
    ...new Set((cartItems ?? []).flatMap((i) => i.related_item_ids ?? [])),
  ].filter((id) => !inCart.includes(id));
  if (relatedIds.length === 0) return NextResponse.json({ items: [] });

  const [{ data: items }, { data: requiredGroups }] = await Promise.all([
    admin
      .from("menu_items")
      .select("id, name, price, image_url, badge_label, badge_color")
      .eq("tenant_id", tenantId)
      .eq("is_available", true)
      .in("id", relatedIds)
      .limit(8),
    admin
      .from("option_groups")
      .select("item_id")
      .eq("tenant_id", tenantId)
      .eq("required", true)
      .in("item_id", relatedIds),
  ]);

  const blocked = new Set((requiredGroups ?? []).map((g) => g.item_id));
  return NextResponse.json({
    items: (items ?? []).filter((i) => !blocked.has(i.id)).slice(0, 6),
  });
}
