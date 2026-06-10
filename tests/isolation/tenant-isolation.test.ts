import { describe, it, expect, beforeAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  anonClient,
  adminClient,
  staffClient,
  tenantIdBySlug,
} from "./helpers";

let ownerA: SupabaseClient;
let tenantA: string;
let tenantB: string;

beforeAll(async () => {
  ownerA = await staffClient("owner-a@demo.test");
  tenantA = await tenantIdBySlug("demo-a");
  tenantB = await tenantIdBySlug("demo-b");
});

describe("tenant isolation (iron rule)", () => {
  it("staff A sees only tenant A menu items", async () => {
    // Sample a real tenant-A item via admin, then assert staff A sees it.
    const { data: sample } = await adminClient()
      .from("menu_items").select("name")
      .eq("tenant_id", tenantA).limit(1).single();

    const { data, error } = await ownerA.from("menu_items").select("name, tenant_id");
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.every((r) => r.tenant_id === tenantA)).toBe(true);
    expect(data!.map((r) => r.name)).toContain(sample!.name);
    expect(data!.map((r) => r.name)).not.toContain("מרגריטה"); // tenant B's pizza
  });

  it("staff A gets zero rows even when explicitly filtering for tenant B", async () => {
    const { data, error } = await ownerA
      .from("menu_items").select("id").eq("tenant_id", tenantB);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("staff A sees only their own tenant row", async () => {
    const { data, error } = await ownerA.from("tenants").select("id, slug");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].slug).toBe("demo-a");
  });

  it("staff A cannot update tenant B's items", async () => {
    const admin = adminClient();
    const { data: target } = await admin
      .from("menu_items").select("id, name")
      .eq("tenant_id", tenantB).limit(1).single();

    const { data: updated, error } = await ownerA
      .from("menu_items")
      .update({ name: "HACKED" })
      .eq("id", target!.id)
      .select();
    // RLS: zero rows matched, no error surfaced, nothing changed.
    expect(error).toBeNull();
    expect(updated).toHaveLength(0);

    const { data: after } = await admin
      .from("menu_items").select("name").eq("id", target!.id).single();
    expect(after!.name).toBe(target!.name);
  });

  it("staff A cannot insert rows stamped with tenant B's id", async () => {
    const { data: catB } = await adminClient()
      .from("menu_categories").select("id")
      .eq("tenant_id", tenantB).limit(1).single();

    const { error } = await ownerA.from("menu_items").insert({
      tenant_id: tenantB,
      category_id: catB!.id,
      name: "smuggled item",
      price: 100,
    });
    expect(error).not.toBeNull(); // RLS with-check violation
  });

  it("anonymous client reads nothing from any tenant table", async () => {
    const anon = anonClient();
    for (const table of [
      "tenants",
      "themes",
      "roles",
      "staff_members",
      "menu_categories",
      "menu_items",
      "option_groups",
      "options",
    ]) {
      const { data } = await anon.from(table).select("*").limit(5);
      expect(data ?? []).toHaveLength(0);
    }
  });

  it("staff A cannot read tenant B's staff or roles", async () => {
    const { data: staff } = await ownerA.from("staff_members").select("tenant_id");
    expect(staff!.every((r) => r.tenant_id === tenantA)).toBe(true);
    const { data: roles } = await ownerA.from("roles").select("tenant_id");
    expect(roles!.every((r) => r.tenant_id === tenantA)).toBe(true);
  });
});
