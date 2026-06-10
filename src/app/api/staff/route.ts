import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff, hasPermission, adminDb } from "@/lib/server/auth";

const ROLE_PRESETS: Record<string, { name: string; permissions: string[] }> = {
  owner: { name: "בעלים", permissions: ["*"] },
  manager: {
    name: "מנהל",
    permissions: [
      "view_orders", "manage_orders", "view_menu", "manage_menu",
      "manage_settings", "manage_branding", "manage_delivery", "view_reports",
    ],
  },
  kitchen: { name: "מטבח", permissions: ["view_orders", "manage_orders"] },
  delivery: { name: "שליח", permissions: ["view_orders"] },
};

async function ensureRole(tenantId: string, key: string): Promise<string | null> {
  const preset = ROLE_PRESETS[key];
  if (!preset) return null;
  const admin = adminDb();
  const { data: existing } = await admin
    .from("roles").select("id").eq("tenant_id", tenantId).eq("key", key).maybeSingle();
  if (existing) return existing.id;
  const { data } = await admin
    .from("roles")
    .insert({ tenant_id: tenantId, key, name: preset.name, permissions: preset.permissions })
    .select("id").single();
  return data?.id ?? null;
}

export async function GET(req: Request) {
  const ctx = await requireStaff(req);
  if (!ctx || !hasPermission(ctx, "manage_staff") && ctx.roleKey !== "owner") {
    return NextResponse.json({ error: { code: "forbidden" } }, { status: 403 });
  }
  const admin = adminDb();
  const { data: members } = await admin
    .from("staff_members")
    .select("id, user_id, created_at, roles(key, name)")
    .eq("tenant_id", ctx.tenantId);

  const result = [];
  for (const m of members ?? []) {
    const { data: u } = await admin.auth.admin.getUserById(m.user_id);
    result.push({
      id: m.id,
      email: u.user?.email ?? "—",
      role: (m.roles as unknown as { key: string; name: string }) ?? null,
      created_at: m.created_at,
      is_me: m.user_id === ctx.userId,
    });
  }
  return NextResponse.json({ staff: result });
}

const CreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  role: z.enum(["owner", "manager", "kitchen", "delivery"]),
});

export async function POST(req: Request) {
  const ctx = await requireStaff(req);
  if (!ctx || ctx.roleKey !== "owner") {
    return NextResponse.json({ error: { code: "forbidden" } }, { status: 403 });
  }
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "validation_error" } }, { status: 422 });
  }
  const { email, password, role } = parsed.data;

  const roleId = await ensureRole(ctx.tenantId, role);
  if (!roleId) {
    return NextResponse.json({ error: { code: "bad_role" } }, { status: 422 });
  }

  const admin = adminDb();
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { tenant_id: ctx.tenantId },
  });
  if (created.error || !created.data.user) {
    return NextResponse.json(
      { error: { code: "user_exists", message: "אימייל כבר קיים במערכת" } },
      { status: 409 }
    );
  }

  const { error } = await admin.from("staff_members").insert({
    tenant_id: ctx.tenantId,
    user_id: created.data.user.id,
    role_id: roleId,
  });
  if (error) {
    return NextResponse.json({ error: { code: "insert_failed" } }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
