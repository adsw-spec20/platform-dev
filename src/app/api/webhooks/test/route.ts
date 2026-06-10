import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff, adminDb } from "@/lib/server/auth";
import { processDueDeliveries } from "@/lib/webhooks/dispatch";

const Schema = z.object({ endpoint_id: z.string().uuid() });

/** Enqueues a sample order.created delivery and dispatches immediately. */
export async function POST(req: Request) {
  const ctx = await requireStaff(req);
  if (!ctx || ctx.roleKey !== "owner") {
    return NextResponse.json({ error: { code: "forbidden" } }, { status: 403 });
  }
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "validation_error" } }, { status: 422 });
  }

  const admin = adminDb();
  const { data: endpoint } = await admin
    .from("webhook_endpoints")
    .select("id")
    .eq("id", parsed.data.endpoint_id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!endpoint) {
    return NextResponse.json({ error: { code: "not_found" } }, { status: 404 });
  }

  const { data: delivery } = await admin
    .from("webhook_deliveries")
    .insert({
      tenant_id: ctx.tenantId,
      endpoint_id: endpoint.id,
      event: "order.created",
      payload: {
        test: true,
        order_id: "00000000-0000-0000-0000-000000000000",
        number: 999,
        status: "new",
        method: "delivery",
        customer_name: "בדיקת מערכת",
        customer_phone: "0500000000",
        items: [{ name: "מנת בדיקה", qty: 1, line_price: 5500, selections: [] }],
        subtotal: 5500,
        delivery_fee: 1500,
        total: 7000,
      },
    })
    .select("id")
    .single();

  await processDueDeliveries(3);

  const { data: result } = await admin
    .from("webhook_deliveries")
    .select("status, last_status_code, last_error")
    .eq("id", delivery!.id)
    .single();
  return NextResponse.json({ result });
}
