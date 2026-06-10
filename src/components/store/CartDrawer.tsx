"use client";

import { useRouter } from "next/navigation";
import { X, Minus, Plus, Pencil, Trash2 } from "lucide-react";
import { useCart, type CartLine } from "./CartProvider";
import { calcLinePrice } from "@/lib/pricing";
import { formatPrice } from "@/lib/format";

/** Cart drawer per design spec §5. */
export function CartDrawer() {
  const { drawerOpen, setDrawerOpen, lines, subtotal } = useCart();
  const router = useRouter();

  if (!drawerOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-stretch sm:justify-end">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setDrawerOpen(false)}
      />
      <div
        className="relative w-full sm:w-[380px] max-h-[85vh] sm:max-h-none sm:h-full flex flex-col rounded-t-2xl sm:rounded-none shadow-2xl"
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

        {lines.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3">
            <div className="text-5xl">🛒</div>
            <p className="font-bold" style={{ color: "var(--text-color)" }}>
              העגלה ריקה כרגע
            </p>
            <button
              onClick={() => setDrawerOpen(false)}
              className="px-6 py-2.5 rounded-full font-medium text-white"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              לתפריט
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {lines.map((line) => (
                <CartLineRow key={line.lineId} line={line} />
              ))}
            </div>
            <div className="p-4" style={{ borderTop: "1px solid var(--brand-border)" }}>
              <div className="flex justify-between text-sm mb-1">
                <span style={{ color: "var(--brand-text-secondary)" }}>ביניים</span>
                <span className="font-bold" style={{ color: "var(--text-color)" }}>
                  {formatPrice(subtotal)}
                </span>
              </div>
              <p className="text-xs mb-3" style={{ color: "var(--brand-text-secondary)" }}>
                דמי משלוח יחושבו בקופה
              </p>
              <button
                onClick={() => {
                  setDrawerOpen(false);
                  router.push("/checkout");
                }}
                className="w-full py-4 rounded-2xl font-bold text-lg text-white"
                style={{
                  backgroundColor: "var(--brand-primary)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                }}
              >
                המשך לקופה · {formatPrice(subtotal)}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CartLineRow({ line }: { line: CartLine }) {
  const { setQty, removeLine, openSheet } = useCart();
  const price = calcLinePrice(line.item, line.selections, line.qty);
  const optionsSummary = line.item.option_groups
    .flatMap((g) =>
      (line.selections[g.id] ?? []).map((s) => {
        const o = g.options.find((x) => x.id === s.optionId);
        return o ? (s.qty > 1 ? `${o.name}×${s.qty}` : o.name) : "";
      })
    )
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className="flex gap-3 p-4 rounded-lg"
      style={{ border: "1px solid var(--brand-border)" }}
    >
      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-gray-100 flex items-center justify-center">
        {line.item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={line.item.image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <span>🍽️</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm" style={{ color: "var(--text-color)" }}>
          {line.item.name}
        </p>
        {optionsSummary && (
          <p className="text-xs truncate" style={{ color: "var(--brand-text-secondary)" }}>
            {optionsSummary}
          </p>
        )}
        {line.notes && (
          <p className="text-xs italic truncate" style={{ color: "var(--brand-text-secondary)" }}>
            “{line.notes}”
          </p>
        )}
        <div className="flex items-center justify-between mt-2">
          <span className="font-bold text-sm" style={{ color: "var(--brand-primary)" }}>
            {formatPrice(price)}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setQty(line.lineId, line.qty - 1)}
              aria-label="הפחת"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white active:scale-90"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="w-6 text-center text-sm font-bold">{line.qty}</span>
            <button
              onClick={() => setQty(line.lineId, line.qty + 1)}
              aria-label="הוסף"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white active:scale-90"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              <Plus className="w-3 h-3" />
            </button>
            {line.item.option_groups.length > 0 && (
              <button
                onClick={() => openSheet(line.item, line)}
                aria-label="עריכה"
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:opacity-70"
                style={{ border: "1px solid var(--brand-border)" }}
              >
                <Pencil className="w-3 h-3" style={{ color: "var(--text-color)" }} />
              </button>
            )}
            <button
              onClick={() => removeLine(line.lineId)}
              aria-label="מחיקה"
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:opacity-70"
              style={{ border: "1px solid var(--brand-border)" }}
            >
              <Trash2 className="w-3 h-3" style={{ color: "#DC2626" }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
