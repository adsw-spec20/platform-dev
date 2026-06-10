"use client";

import { X } from "lucide-react";
import { useCart } from "./CartProvider";
import { CartContents } from "./CartContents";

/** Mobile cart drawer (bottom sheet). Desktop uses the fixed CartSidebar. */
export function CartDrawer() {
  const { drawerOpen, setDrawerOpen } = useCart();

  if (!drawerOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end lg:hidden">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setDrawerOpen(false)}
      />
      <div
        className="relative w-full max-h-[85vh] flex flex-col rounded-t-2xl shadow-2xl"
        style={{ backgroundColor: "var(--brand-bg-card)" }}
      >
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid var(--brand-border)" }}
        >
          <h2 className="font-bold text-lg" style={{ color: "var(--text-color)" }}>
            עגלת הקניות
          </h2>
          <button
            onClick={() => setDrawerOpen(false)}
            aria-label="סגירה"
            className="w-8 h-8 rounded-full flex items-center justify-center hover:opacity-70"
            style={{ border: "1px solid var(--brand-border)" }}
          >
            <X className="w-4 h-4" style={{ color: "var(--text-color)" }} />
          </button>
        </div>
        <CartContents onNavigate={() => setDrawerOpen(false)} />
      </div>
    </div>
  );
}
