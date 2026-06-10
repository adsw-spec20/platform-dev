import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/server/auth";
import { provisionTenant } from "@/lib/server/provision";

/** Super-admin gate: JWT must carry app_metadata.is_super_admin. */
async function requireSuperAdmin(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return false;
  const { data } = await adminDb().auth.getUser(token);
  return data.user?.app_metadata?.is_super_admin === true;
}

export async function GET(req: Request) {
  if (!(await requireSuperAdmin(req))) {
    return NextResponse.json({ error: { code: "forbidden" } }, { status: 403 });
  }
  const admin = adminDb();
  const { data: tenants } = await admin
    .from("tenants")
    .select("id, slug, name, custom_domain, status, created_at")
    .order("created_at", { ascending: false });

  // Order counts per tenant (lightweight aggregate)
  const { data: counts } = await admin.rpc("tenant_order_counts");
  const countMap = new Map(
    ((counts as { tenant_id: string; orders: number }[]) ?? []).map((c) => [c.tenant_id, c.orders])
  );

  return NextResponse.json({
    tenants: (tenants ?? []).map((t) => ({ ...t, orders: countMap.get(t.id) ?? 0 })),
  });
}

const CreateSchema = z.object({
  business_name: z.string().min(2).max(80),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,48}$/),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  if (!(await requireSuperAdmin(req))) {
    return NextResponse.json({ error: { code: "forbidden" } }, { status: 403 });
  }
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "validation_error" } }, { status: 422 });
  }
  const result = await provisionTenant({
    businessName: parsed.data.business_name,
    slug: parsed.data.slug,
    ownerEmail: parsed.data.email,
    ownerPassword: parsed.data.password,
    seedSampleMenu: true,
  });
  if (!result.ok) {
    return NextResponse.json({ error: { code: result.code, message: result.message } }, { status: 409 });
  }
  return NextResponse.json({ ok: true, slug: result.slug }, { status: 201 });
}

const PatchSchema = z.object({
  tenant_id: z.string().uuid(),
  status: z.enum(["trial", "active", "past_due", "suspended"]),
});

export async function PATCH(req: Request) {
  if (!(await requireSuperAdmin(req))) {
    return NextResponse.json({ error: { code: "forbidden" } }, { status: 403 });
  }
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "validation_error" } }, { status: 422 });
  }
  const { error } = await adminDb()
    .from("tenants")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.tenant_id);
  if (error) return NextResponse.json({ error: { code: "update_failed" } }, { status: 500 });
  return NextResponse.json({ ok: true });
}
