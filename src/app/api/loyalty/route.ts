import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server/auth";
import { normalizePhone } from "@/lib/loyalty";

/** Checkout helper: loyalty status for a phone. Balance only (no history). */
export async function GET(req: Request) {
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: { code: "no_tenant" } }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const phone = normalizePhone(searchParams.get("phone") ?? "");

  const admin = adminDb();
  const { data: settings } = await admin
    .from("tenant_settings")
    .select("loyalty_enabled, loyalty_redemption_mode, loyalty_accrual_percent")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!settings?.loyalty_enabled) {
    return NextResponse.json({ enabled: false, balance: 0 });
  }
  if (!phone) {
    return NextResponse.json({ enabled: true, balance: 0, mode: settings.loyalty_redemption_mode });
  }

  const { data: account } = await admin
    .from("loyalty_accounts")
    .select("balance")
    .eq("tenant_id", tenantId)
    .eq("phone", phone)
    .maybeSingle();

  return NextResponse.json({
    enabled: true,
    balance: account?.balance ?? 0,
    mode: settings.loyalty_redemption_mode,
    accrual_percent: settings.loyalty_accrual_percent,
  });
}
