"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Minus, Plus, Check } from "lucide-react";
import type { MenuItem, OptionGroup } from "@/lib/types";
import { calcLinePrice, type Selections } from "@/lib/pricing";
import { validateSelections } from "@/lib/orders/validate";
import { formatPrice } from "@/lib/format";
import { useCart } from "./CartProvider";

/** Item options sheet per design spec §4 (Home Burger gold standard). */
export function ItemOptionsSheet() {
  const { sheetItem, editingLine, closeSheet, addLine, updateLine } = useCart();
  const [selections, setSelections] = useState<Selections>({});
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (sheetItem) {
      if (editingLine) {
        setSelections(editingLine.selections);
        setQty(editingLine.qty);
        setNotes(editingLine.notes ?? "");
      } else {
        // Pre-select defaults
        const init: Selections = {};
        for (const g of sheetItem.option_groups) {
          const defaults = g.options.filter((o) => o.is_default);
          if (defaults.length > 0) {
            init[g.id] = defaults.map((o) => ({ optionId: o.id, qty: 1 }));
          }
        }
        setSelections(init);
        setQty(1);
        setNotes("");
      }
      setShowErrors(false);
    }
  }, [sheetItem, editingLine]);

  const errors = useMemo(
    () => (sheetItem ? validateSelections(sheetItem, selections) : []),
    [sheetItem, selections]
  );
  const total = useMemo(
    () => (sheetItem ? calcLinePrice(sheetItem, selections, qty) : 0),
    [sheetItem, selections, qty]
  );

  if (!sheetItem) return null;

  function submit() {
    if (errors.length > 0) {
      setShowErrors(true);
      return;
    }
    if (editingLine) {
      updateLine(editingLine.lineId, qty, selections, notes || undefined);
    } else {
      addLine(sheetItem!, qty, selections, notes || undefined);
    }
    closeSheet();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center sm:justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closeSheet}
      />
      <div
        className="relative w-full sm:max-w-lg max-h-[88vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl"
        style={{ backgroundColor: "var(--brand-bg-card)" }}
      >
        {/* Drag handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-2">
          <div className="w-10 h-1.5 rounded-full bg-gray-300" />
        </div>

        {/* Image + close */}
        <div className="relative">
          {sheetItem.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sheetItem.image_url}
              alt={sheetItem.name}
              className="w-full h-44 object-cover"
            />
          )}
          <button
            onClick={closeSheet}
            aria-label="סגירה"
            className="absolute top-3 end-3 w-9 h-9 rounded-full bg-black/70 text-white flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          <div>
            <h2 className="text-xl font-bold" style={{ color: "var(--text-color)" }}>
              {sheetItem.name}
            </h2>
            {sheetItem.description && (
              <p className="text-sm mt-1" style={{ color: "var(--brand-text-secondary)" }}>
                {sheetItem.description}
              </p>
            )}
          </div>

          {sheetItem.option_groups.map((group) => (
            <GroupSection
              key={group.id}
              group={group}
              selected={selections[group.id] ?? []}
              onChange={(sel) =>
                setSelections((prev) => ({ ...prev, [group.id]: sel }))
              }
            />
          ))}

          {/* Notes */}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="הערות או בקשות מיוחדות..."
            rows={2}
            className="w-full p-3 text-sm outline-none resize-none"
            style={{
              borderRadius: 12,
              border: "1px solid var(--brand-border)",
              backgroundColor: "var(--brand-bg-card)",
              color: "var(--text-color)",
            }}
          />

          {/* Quantity */}
          <div className="flex items-center justify-center gap-4">
            <QtyButton onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1}>
              <Minus className="w-4 h-4" />
            </QtyButton>
            <span className="font-bold text-lg w-8 text-center">{qty}</span>
            <QtyButton onClick={() => setQty((q) => q + 1)}>
              <Plus className="w-4 h-4" />
            </QtyButton>
          </div>

          {/* Validation */}
          {showErrors && errors.length > 0 && (
            <div
              className="text-sm font-medium rounded-xl p-3"
              style={{ color: "#DC2626", backgroundColor: "#FEF2F2" }}
            >
              {errors.map((e, i) => (
                <div key={i}>{e.message}</div>
              ))}
            </div>
          )}

          {/* CTA */}
          <button
            onClick={submit}
            className="w-full py-3 rounded-xl font-bold text-white"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            {editingLine ? "עדכן בעגלה" : "הוסף לעגלה"} · {formatPrice(total)}
          </button>
        </div>
      </div>
    </div>
  );
}

function GroupSection({
  group,
  selected,
  onChange,
}: {
  group: OptionGroup;
  selected: { optionId: string; qty: number }[];
  onChange: (sel: { optionId: string; qty: number }[]) => void;
}) {
  const totalUnits = selected.reduce((s, x) => s + x.qty, 0);
  const freeLeft = Math.max(0, group.free_quantity - totalUnits);

  function toggleSingle(optionId: string) {
    onChange([{ optionId, qty: 1 }]);
  }
  function toggleMulti(optionId: string) {
    const exists = selected.some((s) => s.optionId === optionId);
    if (exists) {
      onChange(selected.filter((s) => s.optionId !== optionId));
    } else {
      if (group.max_select != null && totalUnits >= group.max_select) return;
      onChange([...selected, { optionId, qty: 1 }]);
    }
  }
  function setOptQty(optionId: string, qty: number) {
    const rest = selected.filter((s) => s.optionId !== optionId);
    onChange(qty <= 0 ? rest : [...rest, { optionId, qty }]);
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h3 className="font-bold" style={{ color: "var(--text-color)" }}>
          {group.name}
        </h3>
        {group.required && (
          <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: "#DC2626" }}>
            חובה
          </span>
        )}
        {group.free_quantity > 0 && (
          <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: "#16A34A" }}>
            {freeLeft > 0 ? `נותרו ${freeLeft} חינם` : `${group.free_quantity} חינם`}
          </span>
        )}
        {group.max_select != null && group.type === "multi" && (
          <span className="text-xs" style={{ color: "var(--brand-text-secondary)" }}>
            עד {group.max_select} בחירות
          </span>
        )}
      </div>
      {group.free_quantity > 0 && (
        <p className="text-xs mb-2" style={{ color: "var(--brand-text-secondary)" }}>
          עד {group.free_quantity} בחירות ללא תוספת תשלום. כל בחירה נוספת בתוספת מחיר.
        </p>
      )}

      <div className="space-y-1">
        {group.options.map((opt) => {
          const sel = selected.find((s) => s.optionId === opt.id);
          const isSelected = !!sel;

          if (group.type === "quantity") {
            return (
              <div
                key={opt.id}
                className="flex items-center justify-between px-3 py-3 rounded-xl"
                style={{
                  backgroundColor: isSelected
                    ? "color-mix(in srgb, var(--brand-primary) 8%, transparent)"
                    : "transparent",
                }}
              >
                <span className="text-sm" style={{ color: "var(--text-color)" }}>
                  {opt.name}
                  {opt.price_delta > 0 && (
                    <span className="ms-2 text-xs" style={{ color: "var(--brand-text-secondary)" }}>
                      ₪{(opt.price_delta / 100).toFixed(2)} ליח׳
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <QtyButton small onClick={() => setOptQty(opt.id, (sel?.qty ?? 0) - 1)} disabled={!isSelected}>
                    <Minus className="w-3 h-3" />
                  </QtyButton>
                  <span className="w-6 text-center font-bold text-sm">{sel?.qty ?? 0}</span>
                  <QtyButton
                    small
                    onClick={() => setOptQty(opt.id, (sel?.qty ?? 0) + 1)}
                    disabled={opt.max_qty != null && (sel?.qty ?? 0) >= opt.max_qty}
                  >
                    <Plus className="w-3 h-3" />
                  </QtyButton>
                </div>
              </div>
            );
          }

          const onClick =
            group.type === "single" ? () => toggleSingle(opt.id) : () => toggleMulti(opt.id);

          return (
            <button
              key={opt.id}
              onClick={onClick}
              className="w-full flex items-center justify-between px-3 py-3 rounded-xl text-start transition-opacity hover:opacity-90"
              style={{
                backgroundColor: isSelected
                  ? "color-mix(in srgb, var(--brand-primary) 8%, transparent)"
                  : "transparent",
              }}
            >
              <span className="flex items-center gap-3">
                {group.type === "single" ? (
                  <span
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                    style={{
                      borderColor: isSelected ? "var(--brand-primary)" : "var(--brand-border)",
                    }}
                  >
                    {isSelected && (
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "var(--brand-primary)" }} />
                    )}
                  </span>
                ) : (
                  <span
                    className="w-5 h-5 rounded border-2 flex items-center justify-center"
                    style={{
                      borderColor: isSelected ? "var(--brand-primary)" : "var(--brand-border)",
                      backgroundColor: isSelected ? "var(--brand-primary)" : "transparent",
                    }}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                  </span>
                )}
                <span className="text-sm" style={{ color: "var(--text-color)" }}>
                  {opt.name}
                </span>
              </span>
              {opt.price_delta > 0 && (
                <span className="text-xs font-medium" style={{ color: "var(--brand-text-secondary)" }}>
                  +₪{(opt.price_delta / 100).toFixed(2)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QtyButton({
  children,
  onClick,
  disabled,
  small,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${small ? "w-7 h-7" : "w-9 h-9"} rounded-lg flex items-center justify-center text-white transition-transform active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed`}
      style={{ backgroundColor: "var(--brand-primary)" }}
    >
      {children}
    </button>
  );
}
