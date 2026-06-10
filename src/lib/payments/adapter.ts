/**
 * Payment adapter layer (spec §6). The storefront/API talk ONLY to this
 * interface; each provider (Hypay/Grow/Tranzila) is an adapter behind it.
 * Per-tenant credentials live in tenant_payment_configs (encrypted at rest
 * by Supabase). Activation of a real provider happens in M4 once Adir
 * closes terms with Grow/HYP - the architecture is ready.
 */

export type CreatePaymentInput = {
  tenantId: string;
  orderId: string;
  orderNumber: number;
  amount: number; // agorot
  customerName: string;
  customerPhone: string;
  returnUrl: string;
};

export type CreatePaymentResult =
  | { ok: true; kind: "redirect"; paymentUrl: string; providerRef: string }
  | { ok: true; kind: "none" } // cash - no online step
  | { ok: false; message: string };

export type VerifyResult =
  | { ok: true; paid: boolean; providerRef: string }
  | { ok: false; message: string };

export interface PaymentAdapter {
  readonly key: string;
  /** Begin a payment; returns a redirect URL for hosted payment pages. */
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  /** Verify a payment after the provider redirects back / notifies. */
  verifyPayment(tenantId: string, providerRef: string): Promise<VerifyResult>;
  /** Refund (full). */
  refund(tenantId: string, providerRef: string, amount: number): Promise<{ ok: boolean; message?: string }>;
}

/** Cash on delivery/pickup: no online step, payment settled physically. */
export const cashAdapter: PaymentAdapter = {
  key: "cash",
  async createPayment() {
    return { ok: true, kind: "none" };
  },
  async verifyPayment() {
    return { ok: true, paid: false, providerRef: "cash" };
  },
  async refund() {
    return { ok: true };
  },
};

const registry = new Map<string, PaymentAdapter>([[cashAdapter.key, cashAdapter]]);

// M4 (pending Grow/HYP terms): registry.set("hypay", hypayAdapter) /
// registry.set("grow", growAdapter). Sandbox-first per docs:
// HYP https://developers.hyp.co.il · Grow https://grow-il.readme.io

export function getPaymentAdapter(key: string): PaymentAdapter | null {
  return registry.get(key) ?? null;
}
