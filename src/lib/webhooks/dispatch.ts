import "server-only";
import { adminDb } from "@/lib/server/auth";
import { signPayload } from "./signing";

/** Retry ladder (minutes): immediate -> 1 -> 5 -> 15 -> 60 -> 360 -> abandoned. */
const RETRY_MINUTES = [1, 5, 15, 60, 360];
const MAX_ATTEMPTS = RETRY_MINUTES.length + 1;
const TIMEOUT_MS = 8000;

type Delivery = {
  id: string;
  tenant_id: string;
  endpoint_id: string;
  event: string;
  payload: unknown;
  attempts: number;
  created_at: string;
};

function isUrlAllowed(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (process.env.NODE_ENV === "production") {
      const host = u.hostname;
      if (
        host === "localhost" ||
        host.startsWith("127.") ||
        host.startsWith("10.") ||
        host.startsWith("192.168.") ||
        host.endsWith(".internal")
      ) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

async function attemptDelivery(d: Delivery): Promise<void> {
  const admin = adminDb();
  const { data: endpoint } = await admin
    .from("webhook_endpoints")
    .select("url, secret, is_active")
    .eq("id", d.endpoint_id)
    .maybeSingle();

  if (!endpoint || !endpoint.is_active || !isUrlAllowed(endpoint.url)) {
    await admin
      .from("webhook_deliveries")
      .update({ status: "abandoned", last_error: "endpoint inactive or invalid url" })
      .eq("id", d.id);
    return;
  }

  const envelope = JSON.stringify({
    id: d.id,
    event: d.event,
    created_at: d.created_at,
    tenant_id: d.tenant_id,
    data: d.payload,
  });
  const signature = signPayload(envelope, endpoint.secret);

  let statusCode: number | null = null;
  let errorText: string | null = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Platform-Signature": signature,
        "X-Platform-Event": d.event,
        "X-Platform-Delivery": d.id,
      },
      body: envelope,
      signal: controller.signal,
    });
    clearTimeout(timer);
    statusCode = res.status;
    if (res.ok) {
      await admin
        .from("webhook_deliveries")
        .update({
          status: "delivered",
          attempts: d.attempts + 1,
          last_status_code: statusCode,
          delivered_at: new Date().toISOString(),
        })
        .eq("id", d.id);
      return;
    }
    errorText = `HTTP ${statusCode}`;
  } catch (e) {
    errorText = (e as Error).message?.slice(0, 300) ?? "fetch failed";
  }

  const attempts = d.attempts + 1;
  if (attempts >= MAX_ATTEMPTS) {
    await admin
      .from("webhook_deliveries")
      .update({
        status: "abandoned",
        attempts,
        last_status_code: statusCode,
        last_error: errorText,
      })
      .eq("id", d.id);
  } else {
    const next = new Date(Date.now() + RETRY_MINUTES[attempts - 1] * 60_000);
    await admin
      .from("webhook_deliveries")
      .update({
        status: "failed",
        attempts,
        last_status_code: statusCode,
        last_error: errorText,
        next_attempt_at: next.toISOString(),
      })
      .eq("id", d.id);
  }
}

/** Sends due deliveries (pending/failed past next_attempt_at). Returns count handled. */
export async function processDueDeliveries(limit = 5): Promise<number> {
  const admin = adminDb();
  const { data: due } = await admin
    .from("webhook_deliveries")
    .select("id, tenant_id, endpoint_id, event, payload, attempts, created_at")
    .in("status", ["pending", "failed"])
    // Compare on the DB clock ("now()" is evaluated by PostgREST) -
    // a skewed local clock must not delay dispatch.
    .lte("next_attempt_at", "now()")
    .order("next_attempt_at")
    .limit(limit);

  if (!due || due.length === 0) return 0;
  await Promise.allSettled(due.map((d) => attemptDelivery(d as Delivery)));
  return due.length;
}
