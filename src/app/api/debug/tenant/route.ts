import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  if (!tenantId) {
    return NextResponse.json({ tenant: null, note: "root or unresolved host" });
  }
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  // Server-side DAL pattern: service role + EXPLICIT tenant scoping, always.
  const [{ count: categories }, { count: items }] = await Promise.all([
    db.from("menu_categories")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    db.from("menu_items")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
  ]);
  return NextResponse.json({
    tenant: {
      id: tenantId,
      slug: h.get("x-tenant-slug"),
      status: h.get("x-tenant-status"),
    },
    counts: { categories, items },
  });
}
