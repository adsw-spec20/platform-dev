"use client";

import { useRouter } from "next/navigation";
import { Minus, Plus, Pencil, Trash2, ShoppingCart } from "lucide-react";
import { useCart, type CartLine } from "./CartProvider";
import { calcLinePrice } from "@/lib/pricing";
import { formatPrice } from "@/lib/format";

/** Shared cart body: used by the mobile drawer and the desktop sidebar. */
export function CartContents({ onNavigate }: { onNavigate?: () => void }) {
  const { lines, subtotal } = useCart();
  const router = useRouter();

  if (lines.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3 text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary) 8%, transparent)" }}
        >
          <ShoppingCart className="w-7 h-7" style={{ color: "var(--brand-primary)" }} />
        </div>
        <p className="font-bold" style={{ color: "var(--text-color)" }}>
          העגלה ריקה
        </p>
        <p className="text-xs" style={{ color: "var(--brand-text-secondary)" }}>
          הוסף מנות מהתפריט כדי להתחיל
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {lines.map((line) => (
          <CartLineRow key={line.lineId} line={line} />
        ))}
      </div>
      <div className="p-4" style={{ borderTop: "1px solid var(--brand-border)" }}>
        <div className="flex justify-between text-sm mb-1">
          <span style={{ color: "var(--brand-text-secondary)" }}>סה״כ ביניים</span>
          <span className="font-bold" style={{ color: "var(--text-color)" }}>
            {formatPrice(subtotal)}
          </span>
        </div>
        <p className="text-xs mb-3" style={{ color: "var(--brand-text-secondary)" }}>
          דמי משלוח יחושבו בקופה
        </p>
        <button
          onClick={() => {
            onNavigate?.();
            router.push("/checkout");
          }}
          className="w-full py-4 rounded-2xl font-bold text-lg text-white"
          style={{
            backgroundColor: "var(--brand-primary)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          מעבר לתשלום · {formatPrice(subtotal)}
        </button>
      </div>
    </>
  );
}

export function CartLineRow({ line }: { line: CartLine }) {
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
      className="flex gap-3 p-3 rounded-lg"
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
            <SmallBtn onClick={() => setQty(line.lineId, line.qty - 1)} label="הפחת" solid>
              <Minus className="w-3 h-3" />
            </SmallBtn>
            <span className="w-6 text-center text-sm font-bold">{line.qty}</span>
            <SmallBtn onClick={() => setQty(line.lineId, line.qty + 1)} label="הוסף" solid>
              <Plus className="w-3 h-3" />
            </SmallBtn>
            {line.item.option_groups.length > 0 && (
              <SmallBtn onClick={() => openSheet(line.item, line)} label="עריכה">
                <Pencil className="w-3 h-3" style={{ color: "var(--text-color)" }} />
              </SmallBtn>
            )}
            <SmallBtn onClick={() => removeLine(line.lineId)} label="מחיקה">
              <Trash2 className="w-3 h-3" style={{ color: "#DC2626" }} />
            </SmallBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

function SmallBtn({
  children,
  onClick,
  label,
  solid,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  solid?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-90 transition-transform hover:opacity-80"
      style={
        solid
          ? { backgroundColor: "var(--brand-primary)", color: "#fff" }
          : { border: "1px solid var(--brand-border)" }
      }
    >
      {children}
    </button>
  );
}
