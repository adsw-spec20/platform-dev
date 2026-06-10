import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { requireStaff, adminDb } from "@/lib/server/auth";

const EVENTS = ["order.created", "order.status_changed", "order.cancelled"] as const;

const CreateSchema = z.object({
  url: z.string().url().max(500),
  events: z.array(z.enum(EVENTS)).min(1),
});

export async function POST(req: Request) {
  const ctx = await requireStaff(req);
  if (!ctx || ctx.roleKey !== "owner") {
    return NextResponse.json({ error: { code: "forbidden" } }, { status: 403 });
  }
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "validation_error" } }, { status: 422 });
  }

  const secret = `whsec_${randomBytes(24).toString("hex")}`;
  const { data, error } = await adminDb()
    .from("webhook_endpoints")
    .insert({
      tenant_id: ctx.tenantId,
      url: parsed.data.url,
      events: parsed.data.events,
      secret,
    })
    .select("id, url, events, is_active, created_at")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: { code: "insert_failed" } }, { status: 500 });
  }
  // Secret returned ONCE - never readable again via API.
  return NextResponse.json({ endpoint: { ...data, secret } }, { status: 201 });
}
