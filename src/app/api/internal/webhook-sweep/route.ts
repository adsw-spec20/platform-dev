import { NextResponse } from "next/server";
import { processDueDeliveries } from "@/lib/webhooks/dispatch";

/** Retry sweep. Protected by CRON_SECRET; wired to a scheduler in M9
 *  (until then: piggyback dispatch on order creation + tracking polls). */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: { code: "forbidden" } }, { status: 403 });
  }
  const handled = await processDueDeliveries(20);
  return NextResponse.json({ handled });
}
