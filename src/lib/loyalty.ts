/**
 * Loyalty club logic. All amounts INTEGER AGOROT.
 *
 * Two redemption modes (binding spec §8):
 * - free_redemption: points are cash. Redeem up to min(balance, subtotal).
 * - full_item_redemption: only WHOLE units may be redeemed, each fully
 *   covered by the balance. The canonical example: balance ₪70 with items
 *   ₪40/₪50/₪10 redeems 50+10=60 — never "40+10 plus 20 off the 50".
 *   We maximize the redeemed total via subset-sum DP over unit prices.
 */

export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+972")) digits = "0" + digits.slice(4);
  else if (digits.startsWith("972")) digits = "0" + digits.slice(3);
  if (!/^0\d{8,9}$/.test(digits)) return null;
  return digits;
}

export type RedeemLine = { unitPrice: number; qty: number };

/** Max redeemable subset-sum <= balance over whole units. DP on agorot/10 to bound memory. */
export function bestFullItemSubset(
  balance: number,
  unitPrices: number[]
): { total: number; unitPrices: number[] } {
  // Scale: prices are in agorot; work in 10-agorot units to keep DP small.
  const cap = Math.floor(balance / 10);
  if (cap <= 0 || unitPrices.length === 0) return { total: 0, unitPrices: [] };
  const scaled = unitPrices.map((p) => Math.ceil(p / 10));

  // dp[s] = index-set achievable; track choice for reconstruction.
  const reachable = new Array<number>(cap + 1).fill(-1); // last item idx used
  const prev = new Array<number>(cap + 1).fill(-1); // previous sum
  reachable[0] = -2; // base
  for (let i = 0; i < scaled.length; i++) {
    const w = scaled[i];
    if (w > cap) continue;
    for (let s = cap; s >= w; s--) {
      if (reachable[s] === -1 && reachable[s - w] !== -1 && reachable[s - w] !== i) {
        reachable[s] = i;
        prev[s] = s - w;
      }
    }
  }
  let best = 0;
  for (let s = cap; s > 0; s--) {
    if (reachable[s] !== -1) {
      best = s;
      break;
    }
  }
  // Reconstruct chosen units, then compute the REAL agorot total (un-scaled).
  const chosen: number[] = [];
  let s = best;
  while (s > 0 && reachable[s] >= 0) {
    chosen.push(unitPrices[reachable[s]]);
    s = prev[s];
  }
  let total = chosen.reduce((a, b) => a + b, 0);
  // Ceil-scaling may overshoot the balance by <10 agorot per item; guard.
  while (total > balance && chosen.length > 0) {
    const removed = chosen.pop()!;
    total -= removed;
  }
  return { total, unitPrices: chosen };
}

export function maxRedeemable(
  mode: "free_redemption" | "full_item_redemption",
  balance: number,
  lines: RedeemLine[]
): number {
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  if (balance <= 0 || subtotal <= 0) return 0;

  if (mode === "free_redemption") {
    return Math.min(balance, subtotal);
  }

  const units: number[] = [];
  for (const l of lines) {
    for (let i = 0; i < l.qty; i++) units.push(l.unitPrice);
  }
  return bestFullItemSubset(balance, units).total;
}
