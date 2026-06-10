import { describe, it, expect } from "vitest";
import { signPayload, verifySignature } from "@/lib/webhooks/signing";

describe("webhook HMAC signing (Stripe-style)", () => {
  const secret = "whsec_test_0123456789abcdef";
  const body = '{"event":"order.created","data":{"number":7}}';

  it("produces t=<ts>,v1=<hex> format", () => {
    const sig = signPayload(body, secret, 1781100000);
    expect(sig).toMatch(/^t=1781100000,v1=[0-9a-f]{64}$/);
  });

  it("signature verifies with same secret and body", () => {
    const sig = signPayload(body, secret, 1781100000);
    expect(verifySignature(body, sig, secret, 1781100060)).toBe(true);
  });

  it("rejects tampered body", () => {
    const sig = signPayload(body, secret, 1781100000);
    expect(verifySignature(body + " ", sig, secret, 1781100060)).toBe(false);
  });

  it("rejects wrong secret", () => {
    const sig = signPayload(body, secret, 1781100000);
    expect(verifySignature(body, sig, "whsec_other", 1781100060)).toBe(false);
  });

  it("rejects replay outside 5-minute window", () => {
    const sig = signPayload(body, secret, 1781100000);
    expect(verifySignature(body, sig, secret, 1781100000 + 301)).toBe(false);
  });
});
