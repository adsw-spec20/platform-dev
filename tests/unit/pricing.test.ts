import { describe, it, expect } from "vitest";
import { calcLinePrice, calcCartTotals } from "@/lib/pricing";
import type { MenuItem } from "@/lib/types";

function makeItem(over: Partial<MenuItem> = {}): MenuItem {
  return {
    id: "i1",
    category_id: "c1",
    name: "test",
    description: null,
    price: 5500,
    image_url: null,
    sort_order: 0,
    is_available: true,
    option_groups: [],
    ...over,
  };
}

describe("calcLinePrice", () => {
  it("item with no options: base * qty", () => {
    expect(calcLinePrice(makeItem(), {}, 2)).toBe(11000);
  });

  it("single-choice delta added", () => {
    const item = makeItem({
      price: 5800,
      option_groups: [
        {
          id: "g1", name: "גודל", type: "single", required: true,
          min_select: 1, max_select: 1, free_quantity: 0, sort_order: 0,
          options: [
            { id: "o1", name: "אישית", price_delta: 0, max_qty: null, is_default: true, sort_order: 0 },
            { id: "o2", name: "משפחתית", price_delta: 1700, max_qty: null, is_default: false, sort_order: 1 },
          ],
        },
      ],
    });
    expect(calcLinePrice(item, { g1: [{ optionId: "o2", qty: 1 }] }, 1)).toBe(7500);
  });

  it("free_quantity covers the most expensive units first", () => {
    const item = makeItem({
      option_groups: [
        {
          id: "g1", name: "תוספות", type: "multi", required: false,
          min_select: 0, max_select: 5, free_quantity: 2, sort_order: 0,
          options: [
            { id: "a", name: "חסה", price_delta: 400, max_qty: null, is_default: false, sort_order: 0 },
            { id: "b", name: "עגבנייה", price_delta: 400, max_qty: null, is_default: false, sort_order: 1 },
            { id: "c", name: "ביצת עין", price_delta: 600, max_qty: null, is_default: false, sort_order: 2 },
          ],
        },
      ],
    });
    // selected: 400 + 400 + 600; two free cover 600+400 => pay 400
    const sel = { g1: [{ optionId: "a", qty: 1 }, { optionId: "b", qty: 1 }, { optionId: "c", qty: 1 }] };
    expect(calcLinePrice(item, sel, 1)).toBe(5500 + 400);
  });

  it("free_quantity with quantity-type group counts units", () => {
    const item = makeItem({
      option_groups: [
        {
          id: "g1", name: "רטבים", type: "quantity", required: false,
          min_select: 0, max_select: null, free_quantity: 2, sort_order: 0,
          options: [
            { id: "a", name: "טחינה", price_delta: 500, max_qty: 5, is_default: false, sort_order: 0 },
          ],
        },
      ],
    });
    // 3 units * 500, 2 free => pay 500
    expect(calcLinePrice(item, { g1: [{ optionId: "a", qty: 3 }] }, 1)).toBe(5500 + 500);
  });

  it("all selections free when under free_quantity", () => {
    const item = makeItem({
      option_groups: [
        {
          id: "g1", name: "תוספות", type: "multi", required: false,
          min_select: 0, max_select: 5, free_quantity: 2, sort_order: 0,
          options: [
            { id: "a", name: "חסה", price_delta: 400, max_qty: null, is_default: false, sort_order: 0 },
            { id: "b", name: "בצל", price_delta: 400, max_qty: null, is_default: false, sort_order: 1 },
          ],
        },
      ],
    });
    const sel = { g1: [{ optionId: "a", qty: 1 }, { optionId: "b", qty: 1 }] };
    expect(calcLinePrice(item, sel, 1)).toBe(5500);
  });

  it("options multiply with line quantity", () => {
    const item = makeItem({
      option_groups: [
        {
          id: "g1", name: "תוספות", type: "multi", required: false,
          min_select: 0, max_select: 5, free_quantity: 0, sort_order: 0,
          options: [
            { id: "a", name: "צ'דר", price_delta: 600, max_qty: null, is_default: false, sort_order: 0 },
          ],
        },
      ],
    });
    expect(calcLinePrice(item, { g1: [{ optionId: "a", qty: 1 }] }, 3)).toBe((5500 + 600) * 3);
  });
});

describe("calcCartTotals", () => {
  it("delivery adds fee; pickup does not", () => {
    const lines = [{ linePrice: 10000 }, { linePrice: 2500 }];
    const settings = { delivery_fee: 1500, min_order: 0 };
    expect(calcCartTotals(lines, settings, "delivery")).toEqual({
      subtotal: 12500, delivery_fee: 1500, total: 14000,
    });
    expect(calcCartTotals(lines, settings, "pickup")).toEqual({
      subtotal: 12500, delivery_fee: 0, total: 12500,
    });
  });
});
