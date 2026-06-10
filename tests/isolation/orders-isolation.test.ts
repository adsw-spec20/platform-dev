import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, staffClient, tenantIdBySlug } from "./helpers";

let ownerA: SupabaseClient;
let tenantA: string;
let tenantB: string;
let orderA: string;
let orderB: string;
const created: string[] = [];

async function createTestOrder(tenantId: string): Promise<string> {
  const admin = adminClient();
  const { data: num } = await admin.rpc("next_order_number", {
    p_tenant_id: tenantId,
  });
  const { data, error } = await admin
    .from("orders")
    .insert({
      tenant_id: tenantId,
      number: num,
      method: "pickup",
      customer_name: "בדיקה",
      customer_phone: "0500000000",
      items: [{ name: "test", qty: 1, line_price: 5500, selections: [] }],
      subtotal: 5500,
      delivery_fee: 0,
      total: 5500,
    })
    .select("id")
    .single();
  if (error) throw error;
  created.push(data.id);
  return data.id;
}

beforeAll(async () => {
  ownerA = await staffClient("owner-a@demo.test");
  tenantA = await tenantIdBySlug("demo-a");
  tenantB = await tenantIdBySlug("demo-b");
  orderA = await createTestOrder(tenantA);
  orderB = await createTestOrder(tenantB);
});

afterAll(async () => {
  const admin = adminClient();
  for (const id of created) {
    await admin.from("orders").delete().eq("id", id);
  }
});

describe("orders isolation + state machine (iron rule extension)", () => {
  it("staff A sees only tenant A orders", async () => {
    const { data } = await ownerA.from("orders").select("id, tenant_id");
    expect(data!.some((o) => o.id === orderA)).toBe(true);
    expect(data!.every((o) => o.tenant_id === tenantA)).toBe(true);
    expect(data!.some((o) => o.id === orderB)).toBe(false);
  });

  it("staff A cannot update tenant B's order status", async () => {
    const { data: updated, error } = await ownerA
      .from("orders")
      .update({ status: "preparing" })
      .eq("id", orderB)
      .select();
    expect(error).toBeNull();
    expect(updated).toHaveLength(0); // RLS: no rows matched

    const { data: after } = await adminClient()
      .from("orders").select("status").eq("id", orderB).single();
    expect(after!.status).toBe("new");
  });

  it("staff A advances own order through a valid transition", async () => {
    const { data, error } = await ownerA
      .from("orders")
      .update({ status: "preparing" })
      .eq("id", orderA)
      .select("status");
    expect(error).toBeNull();
    expect(data![0].status).toBe("preparing");
  });

  it("invalid transition is rejected by the DB trigger", async () => {
    // orderA is now 'preparing'; preparing -> completed is illegal (must pass ready)
    const { error } = await ownerA
      .from("orders")
      .update({ status: "completed" })
      .eq("id", orderA);
    expect(error).not.toBeNull();
    expect(error!.message).toContain("invalid_transition");
  });

  it("terminal status cannot move", async () => {
    const admin = adminClient();
    await admin.from("orders").update({ status: "canceled" }).eq("id", orderA);
    const { error } = await admin
      .from("orders")
      .update({ status: "new" })
      .eq("id", orderA);
    expect(error).not.toBeNull();
  });

  it("anonymous client reads no orders", async () => {
    const { anonClient } = await import("./helpers");
    const { data } = await anonClient().from("orders").select("*").limit(5);
    expect(data ?? []).toHaveLength(0);
  });
});
