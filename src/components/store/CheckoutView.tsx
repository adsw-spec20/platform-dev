"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "./CartProvider";
import { calcLinePrice, calcCartTotals } from "@/lib/pricing";
import { formatPrice } from "@/lib/format";

type Settings = {
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  delivery_fee: number;
  min_order: number;
};

/** Checkout per design spec §6. M2: cash only; OTP slot reserved (pending SMS provider). */
export function CheckoutView({ settings }: { settings: Settings }) {
  const { lines, clear } = useCart();
  const router = useRouter();

  const [method, setMethod] = useState<"delivery" | "pickup">(
    settings.delivery_enabled ? "delivery" : "pickup"
  );
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [city, setCity] = useState("");
  const [apartment, setApartment] = useState("");
  const [floor, setFloor] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoneQuote, setZoneQuote] = useState<{ fee: number; zone_name: string | null } | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Live zone-based delivery quote once the address is complete (display only;
  // the server recomputes authoritatively on order creation).
  useEffect(() => {
    if (method !== "delivery" || !street.trim() || !houseNumber.trim() || !city.trim()) {
      setZoneQuote(null);
      setQuoteError(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/delivery-quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            street: street.trim(),
            house_number: houseNumber.trim(),
            city: city.trim(),
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setZoneQuote(data.quote);
          setQuoteError(null);
        } else {
          setZoneQuote(null);
          setQuoteError(data?.error?.message ?? null);
        }
      } catch {
        /* keep previous state on transient errors */
      }
    }, 700);
    return () => clearTimeout(t);
  }, [method, street, houseNumber, city]);

  const totals = useMemo(() => {
    const linePrices = lines.map((l) => ({
      linePrice: calcLinePrice(l.item, l.selections, l.qty),
    }));
    const fee = zoneQuote?.fee ?? settings.delivery_fee;
    return calcCartTotals(linePrices, { delivery_fee: fee, min_order: settings.min_order }, method);
  }, [lines, settings, method, zoneQuote]);

  if (lines.length === 0 && !submitting) {
    return (
      <div className="text-center py-24 px-4">
        <div className="text-5xl mb-4">🛒</div>
        <p className="font-bold">העגלה ריקה</p>
        <button
          onClick={() => router.push("/")}
          className="mt-4 px-6 py-2.5 rounded-full font-medium text-white"
          style={{ backgroundColor: "var(--brand-primary)" }}
        >
          לתפריט
        </button>
      </div>
    );
  }

  const belowMin = totals.subtotal < settings.min_order;

  async function placeOrder() {
    setError(null);
    if (name.trim().length < 2) return setError("נא להזין שם מלא");
    if (!/^0\d{8,9}$/.test(phone.trim())) return setError("מספר טלפון לא תקין");
    if (method === "delivery" && (!street.trim() || !houseNumber.trim() || !city.trim())) {
      return setError("נא למלא כתובת מלאה למשלוח");
    }
    if (belowMin) {
      return setError(`מינימום הזמנה: ${formatPrice(settings.min_order)}`);
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          address:
            method === "delivery"
              ? {
                  street: street.trim(),
                  house_number: houseNumber.trim(),
                  city: city.trim(),
                  apartment: apartment.trim() || undefined,
                  floor: floor.trim() || undefined,
                }
              : undefined,
          customer_notes: notes.trim() || undefined,
          lines: lines.map((l) => ({
            itemId: l.item.id,
            qty: l.qty,
            selections: l.selections,
            notes: l.notes,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "שגיאה ביצירת ההזמנה, נסו שוב");
        setSubmitting(false);
        return;
      }
      clear();
      router.push(`/track/${data.order.id}`);
    } catch {
      setError("שגיאת תקשורת, נסו שוב");
      setSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    borderRadius: 12,
    border: "1px solid var(--brand-border)",
    backgroundColor: "var(--brand-bg-card)",
    color: "var(--text-color)",
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: "var(--text-color)" }}>
        קופה
      </h1>

      {/* Method toggle */}
      <div className="flex gap-2">
        {settings.delivery_enabled && (
          <MethodButton active={method === "delivery"} onClick={() => setMethod("delivery")}>
            משלוח
          </MethodButton>
        )}
        {settings.pickup_enabled && (
          <MethodButton active={method === "pickup"} onClick={() => setMethod("pickup")}>
            איסוף עצמי
          </MethodButton>
        )}
      </div>

      {/* Contact */}
      <div className="space-y-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="שם מלא"
          className="w-full p-3 text-sm outline-none" style={inputStyle} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="טלפון נייד" inputMode="tel"
          className="w-full p-3 text-sm outline-none" style={inputStyle} />
      </div>

      {/* Address */}
      {method === "delivery" && (
        <div className="grid grid-cols-2 gap-3">
          <input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="רחוב"
            className="col-span-2 p-3 text-sm outline-none" style={inputStyle} />
          <input value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} placeholder="מספר בית"
            className="p-3 text-sm outline-none" style={inputStyle} />
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="עיר"
            className="p-3 text-sm outline-none" style={inputStyle} />
          <input value={apartment} onChange={(e) => setApartment(e.target.value)} placeholder="דירה (אופציונלי)"
            className="p-3 text-sm outline-none" style={inputStyle} />
          <input value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="קומה (אופציונלי)"
            className="p-3 text-sm outline-none" style={inputStyle} />
        </div>
      )}

      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
        placeholder="הערות להזמנה (אופציונלי)"
        className="w-full p-3 text-sm outline-none resize-none" style={inputStyle} />

      {/* Totals */}
      <div className="rounded-xl p-4 space-y-1.5" style={{ border: "1px solid var(--brand-border)" }}>
        <Row label="ביניים" value={formatPrice(totals.subtotal)} />
        <Row
          label={zoneQuote?.zone_name ? `דמי משלוח (${zoneQuote.zone_name})` : "דמי משלוח"}
          value={method === "delivery" ? formatPrice(totals.delivery_fee) : "—"}
        />
        {method === "delivery" && quoteError && (
          <p className="text-xs font-medium" style={{ color: "#DC2626" }}>
            {quoteError}
          </p>
        )}
        <div className="pt-2 mt-1 flex justify-between font-bold text-lg"
          style={{ borderTop: "1px solid var(--brand-border)", color: "var(--text-color)" }}>
          <span>סה״כ לתשלום</span>
          <span style={{ color: "var(--brand-primary)" }}>{formatPrice(totals.total)}</span>
        </div>
        <p className="text-xs pt-1" style={{ color: "var(--brand-text-secondary)" }}>
          תשלום במזומן בעת המסירה · תשלום אונליין יתווסף בקרוב
        </p>
      </div>

      {belowMin && (
        <p className="text-sm font-medium" style={{ color: "#DC2626" }}>
          מינימום הזמנה: {formatPrice(settings.min_order)}
        </p>
      )}
      {error && (
        <p className="text-sm font-medium rounded-xl p-3"
          style={{ color: "#DC2626", backgroundColor: "#FEF2F2" }}>
          {error}
        </p>
      )}

      <button
        onClick={placeOrder}
        disabled={submitting || belowMin}
        className="w-full py-4 rounded-2xl font-bold text-lg text-white disabled:opacity-60"
        style={{
          backgroundColor: "var(--brand-primary)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}
      >
        {submitting ? "שולח הזמנה..." : `שליחת הזמנה · ${formatPrice(totals.total)}`}
      </button>
    </div>
  );
}

function MethodButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 py-3 rounded-xl font-bold text-sm transition-colors"
      style={{
        backgroundColor: active ? "var(--brand-primary)" : "var(--brand-bg-card)",
        color: active ? "#fff" : "var(--text-color)",
        border: active ? "1px solid transparent" : "1px solid var(--brand-border)",
      }}
    >
      {children}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span style={{ color: "var(--brand-text-secondary)" }}>{label}</span>
      <span style={{ color: "var(--text-color)" }}>{value}</span>
    </div>
  );
}
