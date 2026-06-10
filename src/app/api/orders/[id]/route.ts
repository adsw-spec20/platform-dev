import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { processDueDeliveries } from "@/lib/webhooks/dispatch";

/** Public order status for the tracking page (order uuid is the capability). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  if (!tenantId) {
    return NextResponse.json({ error: { code: "no_tenant" } }, { status: 404 });
  }
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ error: { code: "not_found" } }, { status: 404 });
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const { data: order } = await db
    .from("orders")
    .select(
      "id, number, status, method, items, subtotal, delivery_fee, total, created_at, customer_name"
    )
    .eq("tenant_id", tenantId) // tenant scoping, always
    .eq("id", id)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: { code: "not_found" } }, { status: 404 });
  }

  // Tracking polls every 5s while orders are active - a natural heartbeat
  // for dispatching status-change webhooks enqueued by the DB trigger.
  await processDueDeliveries(3);

  return NextResponse.json({ order });
}
