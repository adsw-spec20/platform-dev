"use client";

import { ShoppingCart } from "lucide-react";

export function StoreHeader({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl: string | null;
}) {
  return (
    <header
      className="sticky top-0 z-40 px-4 py-3 flex items-center justify-between"
      style={{
        backgroundColor: "var(--brand-bg-card)",
        borderBottom: "1px solid var(--brand-border)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      }}
    >
      <div className="flex items-center gap-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={name} className="h-9 w-auto" />
        ) : (
          <span
            className="text-lg font-bold"
            style={{ color: "var(--brand-primary)" }}
          >
            {name}
          </span>
        )}
      </div>
      {/* Cart placeholder — functional in Milestone 2 */}
      <button
        aria-label="עגלת קניות"
        className="relative w-10 h-10 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
        style={{ border: "1px solid var(--brand-border)" }}
      >
        <ShoppingCart className="w-5 h-5" style={{ color: "var(--text-color)" }} />
        <span
          className="absolute -top-1 -end-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center"
          style={{ backgroundColor: "var(--brand-accent)", color: "#fff" }}
        >
          0
        </span>
      </button>
    </header>
  );
}
