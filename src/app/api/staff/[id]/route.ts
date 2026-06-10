import { NextResponse } from "next/server";
import { requireStaff, adminDb } from "@/lib/server/auth";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireStaff(req);
  if (!ctx || ctx.roleKey !== "owner") {
    return NextResponse.json({ error: { code: "forbidden" } }, { status: 403 });
  }
  const { id } = await params;

  const admin = adminDb();
  const { data: member } = await admin
    .from("staff_members")
    .select("id, user_id")
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId) // tenant scoping, always
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: { code: "not_found" } }, { status: 404 });
  }
  if (member.user_id === ctx.userId) {
    return NextResponse.json(
      { error: { code: "cannot_remove_self", message: "אי אפשר להסיר את עצמך" } },
      { status: 409 }
    );
  }

  await admin.from("staff_members").delete().eq("id", member.id);
  await admin.auth.admin.deleteUser(member.user_id);
  return NextResponse.json({ ok: true });
}
