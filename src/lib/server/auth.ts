import "server-only";
import { createClient } from "@supabase/supabase-js";

export function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export type StaffContext = {
  userId: string;
  tenantId: string;
  roleKey: string;
  permissions: string[];
};

/** Verifies the caller's JWT and staff membership. Returns null when unauthorized. */
export async function requireStaff(req: Request): Promise<StaffContext | null> {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;

  const admin = adminDb();
  const { data: userData, error } = await admin.auth.getUser(token);
  if (error || !userData.user) return null;

  const tenantId = userData.user.app_metadata?.tenant_id;
  if (typeof tenantId !== "string") return null;

  const { data: member } = await admin
    .from("staff_members")
    .select("role_id, roles(key, permissions)")
    .eq("tenant_id", tenantId)
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (!member) return null;

  const role = member.roles as unknown as { key: string; permissions: string[] };
  return {
    userId: userData.user.id,
    tenantId,
    roleKey: role?.key ?? "unknown",
    permissions: role?.permissions ?? [],
  };
}

export function hasPermission(ctx: StaffContext, perm: string): boolean {
  return ctx.permissions.includes("*") || ctx.permissions.includes(perm);
}
