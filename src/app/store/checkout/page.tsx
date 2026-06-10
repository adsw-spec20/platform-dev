import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { CheckoutView } from "@/components/store/CheckoutView";

export default async function CheckoutPage() {
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  if (!tenantId) notFound();

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const { data: settings } = await db
    .from("tenant_settings")
    .select("delivery_enabled, pickup_enabled, delivery_fee, min_order")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!settings) notFound();

  return <CheckoutView settings={settings} />;
}
