import { describe, it, expect } from "vitest";
import { formatPrice } from "@/lib/format";

describe("formatPrice (agorot -> shekels display)", () => {
  it("formats whole shekels", () => {
    expect(formatPrice(5500)).toBe("₪55.00");
  });
  it("formats agorot remainder", () => {
    expect(formatPrice(10850)).toBe("₪108.50");
  });
  it("formats zero", () => {
    expect(formatPrice(0)).toBe("₪0.00");
  });
  it("formats single agora", () => {
    expect(formatPrice(1)).toBe("₪0.01");
  });
});
