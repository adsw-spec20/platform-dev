/**
 * Cart pricing. All amounts INTEGER AGOROT.
 *
 * Free-quantity rule ("n free, rest paid"): within a group, free units cover
 * the MOST EXPENSIVE selected units first (customer-favorable). Pinned by tests.
 */
import type { MenuItem } from "@/lib/types";

export type OptionSelection = { optionId: string; qty: number };
export type Selections = Record<string, OptionSelection[]>; // groupId -> selections

export function calcLinePrice(
  item: MenuItem,
  selections: Selections,
  qty: number
): number {
  let optionsTotal = 0;

  for (const group of item.option_groups) {
    const selected = selections[group.id] ?? [];
    if (selected.length === 0) continue;

    // Expand to unit deltas (a selection of qty 3 = 3 units).
    const unitDeltas: number[] = [];
    for (const sel of selected) {
      const opt = group.options.find((o) => o.id === sel.optionId);
      if (!opt) continue;
      for (let u = 0; u < sel.qty; u++) unitDeltas.push(opt.price_delta);
    }

    // Free units cover the most expensive first.
    unitDeltas.sort((a, b) => b - a);
    const paid = unitDeltas.slice(group.free_quantity);
    optionsTotal += paid.reduce((s, d) => s + d, 0);
  }

  return (item.price + optionsTotal) * qty;
}

export type CartTotals = {
  subtotal: number;
  delivery_fee: number;
  total: number;
};

export function calcCartTotals(
  lines: { linePrice: number }[],
  settings: { delivery_fee: number; min_order: number },
  method: "delivery" | "pickup"
): CartTotals {
  const subtotal = lines.reduce((s, l) => s + l.linePrice, 0);
  const delivery_fee = method === "delivery" ? settings.delivery_fee : 0;
  return { subtotal, delivery_fee, total: subtotal + delivery_fee };
}
