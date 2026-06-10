import "server-only";
import { adminDb } from "@/lib/server/auth";

export type ProvisionInput = {
  businessName: string;
  slug: string;
  ownerEmail: string;
  ownerPassword: string;
  primaryColor?: string;
  seedSampleMenu?: boolean;
};

export type ProvisionResult =
  | { ok: true; tenantId: string; slug: string }
  | { ok: false; code: string; message: string };

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,48}$/;
const RESERVED = new Set(["www", "admin", "api", "app", "dashboard", "signup", "store", "platform", "demo"]);

export async function isSlugAvailable(slug: string): Promise<boolean> {
  if (!SLUG_RE.test(slug) || RESERVED.has(slug)) return false;
  const { data } = await adminDb().from("tenants").select("id").eq("slug", slug).maybeSingle();
  return !data;
}

/** Creates a complete, ready-to-run tenant: tenant + theme + settings +
 *  counters + owner role + owner user + membership (+ optional sample menu).
 *  This is THE provisioning path - wizard, super admin and Wolt onboarding all use it. */
export async function provisionTenant(input: ProvisionInput): Promise<ProvisionResult> {
  const admin = adminDb();
  const slug = input.slug.trim().toLowerCase();

  if (!(await isSlugAvailable(slug))) {
    return { ok: false, code: "slug_taken", message: "הכתובת הזו תפוסה — נסו שם אחר" };
  }

  const { data: tenant, error: tErr } = await admin
    .from("tenants")
    .insert({ slug, name: input.businessName.trim() })
    .select("id")
    .single();
  if (tErr || !tenant) {
    return { ok: false, code: "tenant_failed", message: "יצירת העסק נכשלה" };
  }
  const tenantId = tenant.id;

  const cleanup = async () => {
    await admin.from("tenants").delete().eq("id", tenantId); // cascades
  };

  const { error: themeErr } = await admin.from("themes").insert({
    tenant_id: tenantId,
    ...(input.primaryColor ? { primary_color: input.primaryColor } : {}),
  });
  const { error: settingsErr } = await admin
    .from("tenant_settings").insert({ tenant_id: tenantId });
  const { error: counterErr } = await admin
    .from("order_counters").insert({ tenant_id: tenantId });
  if (themeErr || settingsErr || counterErr) {
    await cleanup();
    return { ok: false, code: "defaults_failed", message: "אתחול ההגדרות נכשל" };
  }

  const { data: role, error: roleErr } = await admin
    .from("roles")
    .insert({ tenant_id: tenantId, key: "owner", name: "בעלים", permissions: ["*"] })
    .select("id")
    .single();
  if (roleErr || !role) {
    await cleanup();
    return { ok: false, code: "role_failed", message: "אתחול ההרשאות נכשל" };
  }

  const created = await admin.auth.admin.createUser({
    email: input.ownerEmail.trim().toLowerCase(),
    password: input.ownerPassword,
    email_confirm: true,
    app_metadata: { tenant_id: tenantId },
  });
  if (created.error || !created.data.user) {
    await cleanup();
    const exists = created.error?.message?.toLowerCase().includes("already");
    return {
      ok: false,
      code: exists ? "email_taken" : "user_failed",
      message: exists ? "האימייל כבר רשום במערכת" : "יצירת המשתמש נכשלה",
    };
  }

  const { error: memberErr } = await admin.from("staff_members").insert({
    tenant_id: tenantId,
    user_id: created.data.user.id,
    role_id: role.id,
  });
  if (memberErr) {
    await admin.auth.admin.deleteUser(created.data.user.id);
    await cleanup();
    return { ok: false, code: "membership_failed", message: "שיוך הבעלים נכשל" };
  }

  if (input.seedSampleMenu) {
    const { data: cat } = await admin
      .from("menu_categories")
      .insert({ tenant_id: tenantId, name: "🍽️ המנות שלנו", sort_order: 0 })
      .select("id")
      .single();
    if (cat) {
      await admin.from("menu_items").insert([
        { tenant_id: tenantId, category_id: cat.id, name: "מנה לדוגמה", description: "ערכו אותי בדשבורד — תפריט ← מנה", price: 4500, sort_order: 0 },
        { tenant_id: tenantId, category_id: cat.id, name: "תוספת לדוגמה", description: "אפשר למחוק ולהוסיף מנות חופשי", price: 1500, sort_order: 1 },
      ]);
    }
  }

  return { ok: true, tenantId, slug };
}
