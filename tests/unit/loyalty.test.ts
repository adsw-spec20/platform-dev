import { describe, it, expect } from "vitest";
import { normalizePhone, maxRedeemable, bestFullItemSubset } from "@/lib/loyalty";

describe("normalizePhone", () => {
  it("strips separators and country code", () => {
    expect(normalizePhone("050-123 4567")).toBe("0501234567");
    expect(normalizePhone("+972501234567")).toBe("0501234567");
    expect(normalizePhone("972-50-1234567")).toBe("0501234567");
  });
  it("rejects invalid", () => {
    expect(normalizePhone("12345")).toBeNull();
  });
});

describe("loyalty redemption — free_redemption mode", () => {
  it("points are cash, capped by balance and subtotal", () => {
    expect(maxRedeemable("free_redemption", 500, [{ unitPrice: 5000, qty: 1 }])).toBe(500);
    expect(maxRedeemable("free_redemption", 99999, [{ unitPrice: 5000, qty: 1 }])).toBe(5000);
  });
});

describe("loyalty redemption — full_item_redemption mode (Adir's rule)", () => {
  it("the canonical 70/40/50/10 example: best is 50+10=60", () => {
    // balance ₪70; items ₪40, ₪50, ₪10 -> redeem 50+10 (NOT 40+10+20-off-50)
    const lines = [
      { unitPrice: 4000, qty: 1 },
      { unitPrice: 5000, qty: 1 },
      { unitPrice: 1000, qty: 1 },
    ];
    expect(maxRedeemable("full_item_redemption", 7000, lines)).toBe(6000);
  });

  it("no partial coverage: balance 20 with items 40/50 redeems nothing", () => {
    const lines = [
      { unitPrice: 4000, qty: 1 },
      { unitPrice: 5000, qty: 1 },
    ];
    expect(maxRedeemable("full_item_redemption", 2000, lines)).toBe(0);
  });

  it("qty lines expand to units: 2x30 with balance 45 redeems one unit (30)", () => {
    const lines = [{ unitPrice: 3000, qty: 2 }];
    expect(maxRedeemable("full_item_redemption", 4500, lines)).toBe(3000);
  });

  it("exact full coverage allowed", () => {
    const lines = [{ unitPrice: 5000, qty: 1 }];
    expect(maxRedeemable("full_item_redemption", 5000, lines)).toBe(5000);
  });

  it("subset reported for UI", () => {
    const { total, unitPrices } = bestFullItemSubset(7000, [4000, 5000, 1000]);
    expect(total).toBe(6000);
    expect(unitPrices.sort()).toEqual([1000, 5000]);
  });
});
