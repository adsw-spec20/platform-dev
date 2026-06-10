"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Ticket, Gift } from "lucide-react";
import { useCart } from "./CartProvider";
import { calcLinePrice } from "@/lib/pricing";
import { maxRedeemable, normalizePhone } from "@/lib/loyalty";
import { formatPrice } from "@/lib/format";

type Settings = {
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  delivery_fee: number;
  min_order: number;
};

type UpsellItem = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  badge_label: string | null;
};

/** Checkout per design spec §6: method, address+zone fee, coupon, loyalty,
 *  upsell carousel. Cash in M2-M3; payment adapter slots in at M4.
 *  OTP slot reserved at the phone step (pending SMS provider). */
export function CheckoutView({ settings }: { settings: Settings }) {
  const { lines, clear, addLine } = useCart();
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

  // Zone-priced delivery quote
  const [zoneQuote, setZoneQuote] = useState<{ fee: number; zone_name: string | null } | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Coupon
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);

  // Loyalty
  const [loyalty, setLoyalty] = useState<{
    enabled: boolean;
    balance: number;
    mode?: "free_redemption" | "full_item_redemption";
  } | null>(null);
  const [redeem, setRedeem] = useState(false);

  // Upsell
  const [upsell, setUpsell] = useState<UpsellItem[]>([]);

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + calcLinePrice(l.item, l.selections, l.qty), 0),
    [lines]
  );

  // Delivery quote when address is complete
  useEffect(() => {
    setZoneQuote(null);
    setQuoteError(null);
    if (method !== "delivery" || !street.trim() || !houseNumber.trim() || !city.trim()) return;
    if (quoteTimer.current) clearTimeout(quoteTimer.current);
    quoteTimer.current = setTimeout(async () => {
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
        if (res.ok) setZoneQuote(data.quote);
        else setQuoteError(data?.error?.message ?? null);
      } catch {
        /* keep default fee on transient errors */
      }
    }, 800);
    return () => {
      if (quoteTimer.current) clearTimeout(quoteTimer.current);
    };
  }, [method, street, houseNumber, city]);

  // Loyalty status when phone looks valid
  useEffect(() => {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setLoyalty(null);
      setRedeem(false);
      return;
    }
    fetch(`/api/loyalty?phone=${normalized}`)
      .then((r) => r.json())
      .then(setLoyalty)
      .catch(() => setLoyalty(null));
  }, [phone]);

  // Upsell carousel
  useEffect(() => {
    if (lines.length === 0) return;
    const ids = [...new Set(lines.map((l) => l.item.id))].join(",");
    fetch(`/api/upsell?items=${ids}`)
      .then((r) => r.json())
      .then((d) => setUpsell(d.items ?? []))
      .catch(() => setUpsell([]));
  }, [lines]);

  const redeemable = useMemo(() => {
    if (!redeem || !loyalty?.enabled || !loyalty.balance || !loyalty.mode) return 0;
    const units = lines.map((l) => ({
      unitPrice: Math.round(calcLinePrice(l.item, l.selections, l.qty) / l.qty),
      qty: l.qty,
    }));
    const r = maxRedeemable(loyalty.mode, loyalty.balance, units);
    return Math.min(r, subtotal - (coupon?.discount ?? 0));
  }, [redeem, loyalty, lines, subtotal, coupon]);

  const deliveryFee = method === "delivery" ? (zoneQuote?.fee ?? settings.delivery_fee) : 0;
  const discount = coupon?.discount ?? 0;
  const total = Math.max(0, subtotal - discount - redeemable) + deliveryFee;
  const belowMin = subtotal < settings.min_order;

  async function applyCoupon() {
    setCouponError(null);
    setCouponBusy(true);
    try {
      const res = await fetch("/api/coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponInput.trim(), subtotal }),
      });
      const data = await res.json();
      if (res.ok) setCoupon({ code: couponInput.trim().toUpperCase(), discount: data.discount });
      else setCouponError(data?.error?.message ?? "קוד לא תקף");
    } catch {
      setCouponError("שגיאת תקשורת");
    }
    setCouponBusy(false);
  }

  async function placeOrder() {
    setError(null);
    if (name.trim().length < 2) return setError("נא להזין שם מלא");
    if (!/^0\d{8,9}$/.test(phone.trim().replace(/[^\d]/g, "")))
      return setError("מספר טלפון לא תקין");
    if (method === "delivery" && (!street.trim() || !houseNumber.trim() || !city.trim())) {
      return setError("נא למלא כתובת מלאה למשלוח");
    }
    if (belowMin) return setError(`מינימום הזמנה: ${formatPrice(settings.min_order)}`);

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          customer_name: name.trim(),
          customer_phone: phone.trim().replace(/[^\d]/g, ""),
          coupon_code: coupon?.code,
          redeem_loyalty: redeem && redeemable > 0,
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
            🛵 משלוח
          </MethodButton>
        )}
        {settings.pickup_enabled && (
          <MethodButton active={method === "pickup"} onClick={() => setMethod("pickup")}>
            🏃 איסוף עצמי
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

      {/* Loyalty */}
      {loyalty?.enabled && loyalty.balance > 0 && (
        <label
          className="flex items-center gap-3 p-3 rounded-xl cursor-pointer"
          style={{ border: "1px solid var(--brand-border)", backgroundColor: "color-mix(in srgb, var(--brand-accent) 8%, transparent)" }}
        >
          <Gift className="w-5 h-5 shrink-0" style={{ color: "var(--brand-accent)" }} />
          <span className="flex-1 text-sm" style={{ color: "var(--text-color)" }}>
            יש לך <b>{formatPrice(loyalty.balance)}</b> במועדון —{" "}
            {loyalty.mode === "full_item_redemption" ? "מימוש על פריטים שלמים" : "מימוש חופשי"}
          </span>
          <input type="checkbox" checked={redeem} onChange={(e) => setRedeem(e.target.checked)} />
        </label>
      )}
      {redeem && redeemable === 0 && loyalty?.mode === "full_item_redemption" && (
        <p className="text-xs" style={{ color: "var(--brand-text-secondary)" }}>
          אין כרגע פריט בעגלה שהיתרה מכסה במלואו — הוסיפו פריט זול יותר או המשיכו לצבור.
        </p>
      )}

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

      {/* Coupon */}
      <div className="space-y-1">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Ticket className="absolute top-1/2 -translate-y-1/2 end-3 w-4 h-4" style={{ color: "var(--brand-text-secondary)" }} />
            <input
              value={couponInput}
              onChange={(e) => { setCouponInput(e.target.value); setCoupon(null); setCouponError(null); }}
              placeholder="קוד קופון"
              className="w-full p-3 text-sm outline-none"
              style={inputStyle}
              dir="ltr"
            />
          </div>
          <button
            onClick={applyCoupon}
            disabled={couponBusy || !couponInput.trim() || !!coupon}
            className="px-4 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ border: "1px solid var(--brand-border)", color: "var(--text-color)" }}
          >
            {coupon ? "הוחל ✓" : couponBusy ? "בודק..." : "החל קוד"}
          </button>
        </div>
        {couponError && <p className="text-xs font-medium" style={{ color: "#DC2626" }}>{couponError}</p>}
        {coupon && (
          <p className="text-xs font-medium" style={{ color: "#16A34A" }}>
            קוד {coupon.code} הוחל — חיסכון {formatPrice(coupon.discount)} ✓
          </p>
        )}
      </div>

      {/* Upsell */}
      {upsell.length > 0 && (
        <div>
          <h3 className="text-sm font-bold mb-2" style={{ color: "var(--text-color)" }}>
            משלימים את ההזמנה 😋
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {upsell.map((u) => (
              <div
                key={u.id}
                className="shrink-0 w-32 rounded-xl overflow-hidden"
                style={{ border: "1px solid var(--brand-border)", backgroundColor: "var(--brand-bg-card)" }}
              >
                <div className="h-20 bg-gray-100 flex items-center justify-center">
                  {u.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">🍽️</span>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium truncate" style={{ color: "var(--text-color)" }}>
                    {u.name}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs font-bold" style={{ color: "var(--brand-primary)" }}>
                      {formatPrice(u.price)}
                    </span>
                    <button
                      aria-label={`הוסף ${u.name}`}
                      onClick={() =>
                        addLine(
                          {
                            id: u.id, category_id: "", name: u.name, description: null,
                            price: u.price, image_url: u.image_url, sort_order: 0,
                            is_available: true, badge_label: u.badge_label,
                            badge_color: null, option_groups: [],
                          },
                          1,
                          {}
                        )
                      }
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white"
                      style={{ backgroundColor: "var(--brand-primary)" }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="rounded-xl p-4 space-y-1.5" style={{ border: "1px solid var(--brand-border)" }}>
        <Row label="ביניים" value={formatPrice(subtotal)} />
        {discount > 0 && <Row label={`קופון (${coupon!.code})`} value={`-${formatPrice(discount)}`} accent="#16A34A" />}
        {redeemable > 0 && <Row label="מימוש נקודות" value={`-${formatPrice(redeemable)}`} accent="#16A34A" />}
        <Row
          label={zoneQuote?.zone_name ? `דמי משלוח (${zoneQuote.zone_name})` : "דמי משלוח"}
          value={method === "delivery" ? formatPrice(deliveryFee) : "—"}
        />
        {method === "delivery" && quoteError && (
          <p className="text-xs font-medium" style={{ color: "#DC2626" }}>{quoteError}</p>
        )}
        <div className="pt-2 mt-1 flex justify-between font-bold text-lg"
          style={{ borderTop: "1px solid var(--brand-border)", color: "var(--text-color)" }}>
          <span>סה״כ לתשלום</span>
          <span style={{ color: "var(--brand-primary)" }}>{formatPrice(total)}</span>
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
        <p className="text-sm font-medium rounded-xl p-3" style={{ color: "#DC2626", backgroundColor: "#FEF2F2" }}>
          {error}
        </p>
      )}

      <button
        onClick={placeOrder}
        disabled={submitting || belowMin}
        className="w-full py-4 rounded-2xl font-bold text-lg text-white disabled:opacity-60"
        style={{ backgroundColor: "var(--brand-primary)", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
      >
        {submitting ? "שולח הזמנה..." : `שליחת הזמנה · ${formatPrice(total)}`}
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

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span style={{ color: "var(--brand-text-secondary)" }}>{label}</span>
      <span style={{ color: accent ?? "var(--text-color)", fontWeight: accent ? 700 : 400 }}>{value}</span>
    </div>
  );
}
