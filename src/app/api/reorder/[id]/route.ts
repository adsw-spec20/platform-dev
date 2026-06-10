import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server/auth";
import { getFullMenu } from "@/lib/dal/tenant-data";
import type { MenuItem } from "@/lib/types";
import type { Selections } from "@/lib/pricing";

/** One-click reorder: maps a past order's snapshot onto the CURRENT menu
 *  (by item id, falling back to name; selections matched by group/option
 *  names). Skips items that no longer exist; client reports what dropped. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: { code: "no_tenant" } }, { status: 404 });
  const { id } = await params;

  const { data: order } = await adminDb()
    .from("orders")
    .select("items")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: { code: "not_found" } }, { status: 404 });

  const menu = await getFullMenu(tenantId);
  const allItems = menu.flatMap((c) => c.items);
  const byId = new Map(allItems.map((i) => [i.id, i]));
  const byName = new Map(allItems.map((i) => [i.name, i]));

  const lines: { item: MenuItem; qty: number; selections: Selections; notes?: string }[] = [];
  const dropped: string[] = [];

  type SnapLine = {
    item_id: string;
    name: string;
    qty: number;
    notes: string | null;
    selections: { group_name: string; options: { name: string; qty: number }[] }[];
  };

  for (const snap of order.items as SnapLine[]) {
    const item = byId.get(snap.item_id) ?? byName.get(snap.name);
    if (!item || !item.is_available) {
      dropped.push(snap.name);
      continue;
    }
    const selections: Selections = {};
    for (const g of snap.selections ?? []) {
      const group = item.option_groups.find((og) => og.name === g.group_name);
      if (!group) continue;
      const sels = g.options
        .map((o) => {
          const opt = group.options.find((x) => x.name === o.name);
          return opt ? { optionId: opt.id, qty: o.qty } : null;
        })
        .filter((x): x is { optionId: string; qty: number } => x !== null);
      if (sels.length > 0) selections[group.id] = sels;
    }
    // Required groups must still validate; if a required group lost its
    // selection mapping, drop the item rather than create an invalid line.
    const missingRequired = item.option_groups.some(
      (g) => g.required && !(selections[g.id]?.length)
    );
    if (missingRequired) {
      dropped.push(snap.name);
      continue;
    }
    lines.push({ item, qty: snap.qty, selections, notes: snap.notes ?? undefined });
  }

  return NextResponse.json({ lines, dropped });
}
