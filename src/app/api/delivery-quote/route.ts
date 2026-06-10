import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/server/auth";
import { quoteDelivery } from "@/lib/server/delivery";

const Schema = z.object({
  street: z.string().min(1).max(200),
  house_number: z.string().min(1).max(20),
  city: z.string().min(1).max(100),
});

export async function POST(req: Request) {
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  if (!tenantId) {
    return NextResponse.json({ error: { code: "no_tenant" } }, { status: 404 });
  }
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "validation_error" } }, { status: 422 });
  }

  const { data: settings } = await adminDb()
    .from("tenant_settings")
    .select("delivery_fee")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const quote = await quoteDelivery(tenantId, parsed.data, settings?.delivery_fee ?? 0);
  if (!quote.ok) {
    const message =
      quote.reason === "outside_zones"
        ? "הכתובת מחוץ לאזורי המשלוח שלנו"
        : "לא הצלחנו לאתר את הכתובת — בדקו את הפרטים";
    return NextResponse.json({ error: { code: quote.reason, message } }, { status: 409 });
  }
  return NextResponse.json({ quote });
}
