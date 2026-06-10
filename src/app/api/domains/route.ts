import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff, adminDb } from "@/lib/server/auth";

const VERCEL_API = "https://api.vercel.com";

function vercelHeaders() {
  return {
    Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
    "Content-Type": "application/json",
  };
}
const PROJECT = process.env.VERCEL_PROJECT_NAME ?? "platform-dev";

const Schema = z.object({
  domain: z
    .string()
    .min(4)
    .max(253)
    .regex(/^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/i),
});

/** Connect a custom domain to the tenant's store (mandatory per spec). */
export async function POST(req: Request) {
  const ctx = await requireStaff(req);
  if (!ctx || ctx.roleKey !== "owner") {
    return NextResponse.json({ error: { code: "forbidden" } }, { status: 403 });
  }
  if (!process.env.VERCEL_TOKEN) {
    return NextResponse.json(
      { error: { code: "not_configured", message: "חיבור דומיינים יופעל בקרוב" } },
      { status: 503 }
    );
  }
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "validation_error", message: "דומיין לא תקין" } }, { status: 422 });
  }
  const domain = parsed.data.domain.toLowerCase();

  // One domain per tenant; ensure it isn't claimed by another tenant.
  const admin = adminDb();
  const { data: existing } = await admin
    .from("tenants").select("id").eq("custom_domain", domain).maybeSingle();
  if (existing && existing.id !== ctx.tenantId) {
    return NextResponse.json(
      { error: { code: "domain_taken", message: "הדומיין כבר מחובר לחנות אחרת" } },
      { status: 409 }
    );
  }

  const res = await fetch(`${VERCEL_API}/v10/projects/${PROJECT}/domains`, {
    method: "POST",
    headers: vercelHeaders(),
    body: JSON.stringify({ name: domain }),
  });
  const data = await res.json();
  if (!res.ok && data?.error?.code !== "domain_already_in_use_by_project") {
    return NextResponse.json(
      { error: { code: "vercel_error", message: data?.error?.message ?? "חיבור הדומיין נכשל" } },
      { status: 502 }
    );
  }

  await admin.from("tenants").update({ custom_domain: domain }).eq("id", ctx.tenantId);
  return NextResponse.json({ ok: true, domain });
}

/** Domain + verification status for the dashboard. */
export async function GET(req: Request) {
  const ctx = await requireStaff(req);
  if (!ctx) return NextResponse.json({ error: { code: "forbidden" } }, { status: 403 });

  const { data: tenant } = await adminDb()
    .from("tenants").select("custom_domain").eq("id", ctx.tenantId).single();
  if (!tenant?.custom_domain) return NextResponse.json({ domain: null });

  let verified = false;
  let misconfigured = true;
  if (process.env.VERCEL_TOKEN) {
    try {
      const cfg = await fetch(
        `${VERCEL_API}/v6/domains/${tenant.custom_domain}/config`,
        { headers: vercelHeaders() }
      ).then((r) => r.json());
      misconfigured = cfg?.misconfigured !== false;
      verified = !misconfigured;
    } catch {
      /* leave defaults */
    }
  }
  return NextResponse.json({
    domain: tenant.custom_domain,
    verified,
    dns: {
      apex: { type: "A", value: "76.76.21.21" },
      www: { type: "CNAME", value: "cname.vercel-dns.com" },
    },
  });
}
