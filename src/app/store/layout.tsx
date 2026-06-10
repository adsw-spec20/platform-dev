import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Rubik } from "next/font/google";
import { getTenantContext } from "@/lib/dal/tenant-data";
import type { Theme } from "@/lib/types";
import { StoreHeader } from "@/components/store/StoreHeader";
import { CartProvider } from "@/components/store/CartProvider";
import { CartDrawer } from "@/components/store/CartDrawer";
import { ItemOptionsSheet } from "@/components/store/ItemOptionsSheet";

const rubik = Rubik({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "700"],
  variable: "--font-rubik",
});

/** Design tokens from the tenant's theme row. The storefront knows no colors. */
function themeCss(theme: Theme): string {
  return `:root{
--brand-primary:${theme.primary_color};
--secondary-color:${theme.secondary_color};
--brand-accent:${theme.accent_color};
--brand-bg:${theme.background_color};
--text-color:${theme.text_color};
--brand-bg-card:#ffffff;
--brand-text-secondary:rgba(31,41,55,0.6);
--brand-border:#e5e7eb;
--brand-primary-text:#ffffff;
--footer-bg:${theme.secondary_color};
--footer-text:#ffffff;
}`;
}

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  if (!tenantId) notFound();

  const ctx = await getTenantContext(tenantId);
  if (!ctx) notFound();

  const { tenant, theme } = ctx;

  if (tenant.status === "suspended") {
    return (
      <div
        dir="rtl"
        className={`${rubik.variable} min-h-screen flex items-center justify-center`}
        style={{ backgroundColor: "#FEF2F2", fontFamily: "var(--font-rubik)" }}
      >
        <div className="text-center p-8 rounded-2xl bg-white shadow-xl max-w-sm">
          <div className="text-5xl mb-4">🌙</div>
          <h1 className="text-xl font-bold text-gray-800">סגור זמנית</h1>
          <p className="text-sm text-gray-500 mt-2">
            החנות אינה זמינה כרגע. נסו שוב מאוחר יותר.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className={`${rubik.variable} min-h-screen flex flex-col`}
      style={{
        backgroundColor: "var(--brand-bg)",
        color: "var(--text-color)",
        fontFamily: "var(--font-rubik), sans-serif",
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: themeCss(theme) }} />
      <CartProvider tenantSlug={tenant.slug}>
        <StoreHeader name={tenant.name} logoUrl={theme.logo_url} />
        <main className="flex-1">{children}</main>
        <CartDrawer />
        <ItemOptionsSheet />
      </CartProvider>
      <footer
        className="py-6 px-4 text-center text-sm"
        style={{
          backgroundColor: "var(--footer-bg)",
          color: "var(--footer-text)",
        }}
      >
        {tenant.name} · מופעל על ידי הפלטפורמה
      </footer>
    </div>
  );
}
