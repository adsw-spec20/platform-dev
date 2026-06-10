import { describe, it, expect } from "vitest";
import { pointInPolygon, resolveZone } from "@/lib/geo";

// Square around Ramla city center (approx).
const SQUARE: [number, number][] = [
  [31.92, 34.85],
  [31.92, 34.88],
  [31.94, 34.88],
  [31.94, 34.85],
];

describe("pointInPolygon (ray casting)", () => {
  it("point inside returns true", () => {
    expect(pointInPolygon([31.93, 34.86], SQUARE)).toBe(true);
  });
  it("point outside returns false", () => {
    expect(pointInPolygon([31.95, 34.86], SQUARE)).toBe(false);
    expect(pointInPolygon([31.93, 34.90], SQUARE)).toBe(false);
  });
  it("handles polygon with many vertices", () => {
    const hex: [number, number][] = [
      [0, 1], [0.87, 0.5], [0.87, -0.5], [0, -1], [-0.87, -0.5], [-0.87, 0.5],
    ];
    expect(pointInPolygon([0, 0], hex)).toBe(true);
    expect(pointInPolygon([1, 1], hex)).toBe(false);
  });
});

describe("resolveZone", () => {
  const zones = [
    { id: "z1", name: "מרכז", price: 1000, polygon: SQUARE, is_active: true, sort_order: 0 },
    {
      id: "z2",
      name: "רחוק",
      price: 2500,
      polygon: [
        [31.90, 34.80], [31.90, 34.95], [31.99, 34.95], [31.99, 34.80],
      ] as [number, number][],
      is_active: true,
      sort_order: 1,
    },
  ];

  it("returns first matching zone by sort order", () => {
    const z = resolveZone([31.93, 34.86], zones);
    expect(z?.id).toBe("z1");
  });
  it("falls through to outer zone", () => {
    const z = resolveZone([31.95, 34.86], zones);
    expect(z?.id).toBe("z2");
  });
  it("returns null outside all zones", () => {
    const z = resolveZone([32.5, 35.5], zones);
    expect(z).toBeNull();
  });
  it("skips inactive zones", () => {
    const z = resolveZone([31.93, 34.86], [{ ...zones[0], is_active: false }]);
    expect(z).toBeNull();
  });
});
