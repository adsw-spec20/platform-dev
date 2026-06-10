"use client";

import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useCart } from "./CartProvider";

export function StoreHeader({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl: string | null;
}) {
  const { count, setDrawerOpen } = useCart();

  return (
    <header
      className="sticky top-0 z-40 px-4 py-3 flex items-center justify-between"
      style={{
        backgroundColor: "var(--brand-bg-card)",
        borderBottom: "1px solid var(--brand-border)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      }}
    >
      <Link href="/" className="flex items-center gap-3">
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
      </Link>
      <button
        aria-label="עגלת קניות"
        onClick={() => setDrawerOpen(true)}
        className="relative w-10 h-10 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
        style={{ border: "1px solid var(--brand-border)" }}
      >
        <ShoppingCart className="w-5 h-5" style={{ color: "var(--text-color)" }} />
        {count > 0 && (
          <span
            className="absolute -top-1 -end-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center"
            style={{ backgroundColor: "var(--brand-accent)", color: "#fff" }}
          >
            {count}
          </span>
        )}
      </button>
    </header>
  );
}
