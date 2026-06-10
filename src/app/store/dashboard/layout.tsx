"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell, UtensilsCrossed, Palette, MapPin, Settings, Users, Plug, LogOut, Menu as MenuIcon, X, Ticket, Gift, DownloadCloud,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { LoginForm } from "@/components/dashboard/LoginForm";

const NAV = [
  { href: "/dashboard", label: "הזמנות", Icon: Bell },
  { href: "/dashboard/menu", label: "תפריט", Icon: UtensilsCrossed },
  { href: "/dashboard/branding", label: "מיתוג", Icon: Palette },
  { href: "/dashboard/zones", label: "אזורי משלוח", Icon: MapPin },
  { href: "/dashboard/import", label: "ייבוא מ-Wolt", Icon: DownloadCloud },
  { href: "/dashboard/coupons", label: "קופונים", Icon: Ticket },
  { href: "/dashboard/loyalty", label: "מועדון", Icon: Gift },
  { href: "/dashboard/settings", label: "הגדרות", Icon: Settings },
  { href: "/dashboard/staff", label: "צוות", Icon: Users },
  { href: "/dashboard/integrations", label: "חיבורים", Icon: Plug },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const supabase = supabaseBrowser();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const failsafe = setTimeout(() => setReady(true), 4000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(failsafe);
    };
  }, []);

  if (!ready) return <div className="p-12 text-center text-sm">טוען...</div>;
  if (!session) return <LoginForm />;

  return (
    <div className="flex min-h-[calc(100vh-120px)]">
      {/* Sidebar (desktop) */}
      <aside
        className="hidden md:flex flex-col w-56 shrink-0 p-3 gap-1"
        style={{ borderInlineEnd: "1px solid var(--brand-border)", backgroundColor: "var(--brand-bg-card)" }}
      >
        <NavLinks pathname={pathname} onNavigate={() => {}} />
        <button
          onClick={async () => {
            await supabaseBrowser().auth.signOut();
            router.push("/dashboard");
          }}
          className="mt-auto flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm hover:opacity-70"
          style={{ color: "var(--brand-text-secondary)" }}
        >
          <LogOut className="w-4 h-4" /> יציאה
        </button>
      </aside>

      {/* Mobile topbar */}
      <div className="md:hidden fixed bottom-4 start-4 z-50">
        <button
          onClick={() => setMobileNav(true)}
          className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg"
          style={{ backgroundColor: "var(--brand-primary)" }}
          aria-label="תפריט ניהול"
        >
          <MenuIcon className="w-5 h-5" />
        </button>
      </div>
      {mobileNav && (
        <div className="md:hidden fixed inset-0 z-[95] flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileNav(false)} />
          <div
            className="relative w-64 p-4 flex flex-col gap-1"
            style={{ backgroundColor: "var(--brand-bg-card)" }}
          >
            <button onClick={() => setMobileNav(false)} aria-label="סגירה" className="self-end mb-2">
              <X className="w-5 h-5" style={{ color: "var(--text-color)" }} />
            </button>
            <NavLinks pathname={pathname} onNavigate={() => setMobileNav(false)} />
            <button
              onClick={async () => {
                await supabaseBrowser().auth.signOut();
                setMobileNav(false);
              }}
              className="mt-4 flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm"
              style={{ color: "var(--brand-text-secondary)" }}
            >
              <LogOut className="w-4 h-4" /> יציאה
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <>
      {NAV.map(({ href, label, Icon }) => {
        const active =
          href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: active ? "var(--brand-primary)" : "transparent",
              color: active ? "#fff" : "var(--text-color)",
            }}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        );
      })}
    </>
  );
}
