"use client";

import { ShoppingCart } from "lucide-react";
import { useCart } from "./CartProvider";
import { CartContents } from "./CartContents";

/** Fixed desktop cart sidebar per design spec §5 (HB "העגלה שלי"). lg+ only. */
export function CartSidebar() {
  const { count } = useCart();

  return (
    <aside
      className="hidden lg:flex flex-col fixed left-4 top-[76px] bottom-4 w-[340px] rounded-2xl overflow-hidden z-30"
      style={{
        backgroundColor: "var(--brand-bg-card)",
        border: "1px solid var(--brand-border)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--brand-border)" }}
      >
        <div>
          <h2 className="font-bold" style={{ color: "var(--text-color)" }}>
            העגלה שלי
          </h2>
          <p className="text-xs" style={{ color: "var(--brand-text-secondary)" }}>
            {count} פריטים
          </p>
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: "var(--brand-primary)" }}
        >
          <ShoppingCart className="w-5 h-5 text-white" />
        </div>
      </div>
      <CartContents />
    </aside>
  );
}
