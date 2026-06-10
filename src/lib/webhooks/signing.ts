/** Stripe-style webhook signing: HMAC-SHA256 over "<timestamp>.<rawBody>".
 *  Header format: t=<unix>,v1=<hex>. Replay window: 5 minutes. */
import { createHmac, timingSafeEqual } from "crypto";

export const REPLAY_WINDOW_SECONDS = 300;

export function signPayload(
  rawBody: string,
  secret: string,
  timestamp: number = Math.floor(Date.now() / 1000)
): string {
  const mac = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return `t=${timestamp},v1=${mac}`;
}

export function verifySignature(
  rawBody: string,
  header: string,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): boolean {
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.split("=") as [string, string])
  );
  const t = Number(parts.t);
  if (!Number.isFinite(t) || Math.abs(nowSeconds - t) > REPLAY_WINDOW_SECONDS) {
    return false;
  }
  const expected = createHmac("sha256", secret)
    .update(`${t}.${rawBody}`)
    .digest("hex");
  const given = parts.v1 ?? "";
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}
