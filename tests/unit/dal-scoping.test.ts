import { describe, it, expect, beforeAll } from "vitest";
import { getFullMenu, getTenantContext } from "@/lib/dal/tenant-data";
import { tenantIdBySlug } from "../isolation/helpers";

let tenantA: string;
let tenantB: string;

beforeAll(async () => {
  tenantA = await tenantIdBySlug("demo-a");
  tenantB = await tenantIdBySlug("demo-b");
});

describe("DAL tenant scoping", () => {
  it("returns only tenant A's menu for tenant A", async () => {
    const menu = await getFullMenu(tenantA);
    const names = menu.flatMap((c) => c.items.map((i) => i.name));
    expect(names.length).toBeGreaterThan(0);
    expect(names).not.toContain("מרגריטה"); // tenant B's pizza
  });

  it("returns only tenant B's menu for tenant B", async () => {
    const menu = await getFullMenu(tenantB);
    const names = menu.flatMap((c) => c.items.map((i) => i.name));
    expect(names).toContain("מרגריטה");
    expect(names).not.toContain("המבורגר קלאסי");
  });

  it("nests option groups with their options", async () => {
    const menu = await getFullMenu(tenantA);
    const items = menu.flatMap((c) => c.items);
    const withGroups = items.filter((i) => i.option_groups.length > 0);
    expect(withGroups.length).toBeGreaterThan(0);
    // Every group carries its options array; free-quantity groups exist in the HB menu.
    const freeGroup = withGroups
      .flatMap((i) => i.option_groups)
      .find((g) => g.free_quantity > 0);
    expect(freeGroup).toBeDefined();
    expect(freeGroup!.options.length).toBeGreaterThan(0);
  });

  it("returns tenant context with theme", async () => {
    const ctx = await getTenantContext(tenantA);
    expect(ctx!.tenant.slug).toBe("demo-a");
    expect(ctx!.theme.primary_color).toMatch(/^#/);
  });
});
