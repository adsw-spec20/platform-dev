import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/server/auth";

const Schema = z.object({
  code: z.string().min(1).max(40),
  subtotal: z.number().int().min(0),
});

/** Checkout preview: validates a coupon and returns the discount (agorot). */
export async function POST(req: Request) {
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: { code: "no_tenant" } }, { status: 404 });

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "validation_error" } }, { status: 422 });
  }

  const { data: coupon } = await adminDb()
    .from("coupons")
    .select("kind, value, min_subtotal, max_uses, used_count, expires_at, is_active")
    .eq("tenant_id", tenantId)
    .eq("code", parsed.data.code.trim().toUpperCase())
    .eq("is_active", true)
    .maybeSingle();

  const expired = coupon?.expires_at && new Date(coupon.expires_at) < new Date();
  const exhausted = coupon?.max_uses != null && coupon.used_count >= coupon.max_uses;
  if (!coupon || expired || exhausted) {
    return NextResponse.json(
      { error: { code: "invalid_coupon", message: "קוד הקופון אינו תקף" } },
      { status: 409 }
    );
  }
  if (parsed.data.subtotal < coupon.min_subtotal) {
    return NextResponse.json(
      {
        error: {
          code: "below_coupon_minimum",
          message: `הקופון תקף מהזמנה של ₪${(coupon.min_subtotal / 100).toFixed(2)}`,
        },
      },
      { status: 409 }
    );
  }

  const discount =
    coupon.kind === "percent"
      ? Math.round((parsed.data.subtotal * coupon.value) / 100)
      : Math.min(coupon.value, parsed.data.subtotal);

  return NextResponse.json({ discount });
}
