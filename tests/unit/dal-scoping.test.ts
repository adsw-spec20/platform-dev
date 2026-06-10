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
    expect(names).toContain("המבורגר קלאסי");
    expect(names).not.toContain("מרגריטה");
  });

  it("returns only tenant B's menu for tenant B", async () => {
    const menu = await getFullMenu(tenantB);
    const names = menu.flatMap((c) => c.items.map((i) => i.name));
    expect(names).toContain("מרגריטה");
    expect(names).not.toContain("המבורגר קלאסי");
  });

  it("nests option groups with their options", async () => {
    const menu = await getFullMenu(tenantA);
    const burger = menu
      .flatMap((c) => c.items)
      .find((i) => i.name === "המבורגר קלאסי")!;
    expect(burger.option_groups.length).toBe(2);
    const freeGroup = burger.option_groups.find((g) => g.free_quantity === 2)!;
    expect(freeGroup.options.length).toBe(5);
  });

  it("returns tenant context with theme", async () => {
    const ctx = await getTenantContext(tenantA);
    expect(ctx!.tenant.slug).toBe("demo-a");
    expect(ctx!.theme.primary_color).toMatch(/^#/);
  });
});
