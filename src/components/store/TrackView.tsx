"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, ChefHat, Truck, Home, Package, RotateCcw } from "lucide-react";
import { formatPrice } from "@/lib/format";
import type { OrderStatus } from "@/lib/orders/state";
import { useCart } from "./CartProvider";

type TrackedOrder = {
  id: string;
  number: number;
  status: OrderStatus;
  method: "delivery" | "pickup";
  items: {
    name: string;
    qty: number;
    line_price: number;
    selections: { group_name: string; options: { name: string; qty: number }[] }[];
  }[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  customer_name: string;
};

const DELIVERY_STEPS: { key: OrderStatus[]; label: string; Icon: typeof CheckCircle }[] = [
  { key: ["new"], label: "אושרה", Icon: CheckCircle },
  { key: ["preparing"], label: "בהכנה", Icon: ChefHat },
  { key: ["ready", "out_for_delivery"], label: "בדרך אליך", Icon: Truck },
  { key: ["completed"], label: "הושלמה", Icon: Home },
];
const PICKUP_STEPS: { key: OrderStatus[]; label: string; Icon: typeof CheckCircle }[] = [
  { key: ["new"], label: "אושרה", Icon: CheckCircle },
  { key: ["preparing"], label: "בהכנה", Icon: ChefHat },
  { key: ["ready"], label: "מוכנה", Icon: Package },
  { key: ["completed"], label: "הושלמה", Icon: Home },
];

/** Order tracking per design spec §7. Polls every 5s (Realtime push: M3 polish). */
export function TrackView({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [failed, setFailed] = useState(false);
  const [reorderBusy, setReorderBusy] = useState(false);
  const [reorderNote, setReorderNote] = useState<string | null>(null);
  const { addLine, clear } = useCart();
  const router = useRouter();

  async function reorder() {
    setReorderBusy(true);
    setReorderNote(null);
    try {
      const res = await fetch(`/api/reorder/${orderId}`);
      const data = await res.json();
      if (!res.ok || !data.lines?.length) {
        setReorderNote("לא ניתן לשחזר את ההזמנה — התפריט השתנה");
        setReorderBusy(false);
        return;
      }
      clear();
      for (const l of data.lines) addLine(l.item, l.qty, l.selections, l.notes);
      if (data.dropped?.length) {
        setReorderNote(`חלק מהפריטים כבר לא בתפריט: ${data.dropped.join(", ")}`);
        setTimeout(() => router.push("/checkout"), 1800);
      } else {
        router.push("/checkout");
      }
    } catch {
      setReorderNote("שגיאת תקשורת, נסו שוב");
      setReorderBusy(false);
    }
  }

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (!alive) return;
        if (!res.ok) return setFailed(true);
        const data = await res.json();
        setOrder(data.order);
      } catch {
        /* transient network error - keep polling */
      }
    }
    load();
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [orderId]);

  if (failed) {
    return (
      <div className="text-center py-24 px-4">
        <div className="text-5xl mb-4">😕</div>
        <p className="font-bold">ההזמנה לא נמצאה</p>
      </div>
    );
  }
  if (!order) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl animate-pulse bg-black/5" />
        ))}
      </div>
    );
  }

  const steps = order.method === "delivery" ? DELIVERY_STEPS : PICKUP_STEPS;
  const canceled = order.status === "canceled";
  const activeIdx = canceled
    ? -1
    : steps.findIndex((s) => s.key.includes(order.status));
  const progressIdx = activeIdx === -1 && !canceled ? steps.length - 1 : activeIdx;

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      <div className="text-center">
        <div className="text-4xl mb-2">{canceled ? "❌" : "✅"}</div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-color)" }}>
          הזמנה #{order.number}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--brand-text-secondary)" }}>
          {canceled
            ? "ההזמנה בוטלה"
            : `תודה ${order.customer_name}! ההזמנה התקבלה ומתעדכנת כאן בזמן אמת`}
        </p>
      </div>

      {!canceled && (
        <div className="flex items-center px-2">
          {steps.map((step, i) => {
            const active = i <= progressIdx;
            const { Icon } = step;
            return (
              <div key={step.label} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: active ? "var(--brand-primary)" : "var(--brand-border)",
                    }}
                  >
                    <Icon className="w-5 h-5" style={{ color: active ? "#fff" : "var(--brand-text-secondary)" }} />
                  </div>
                  <span
                    className="mt-2 text-xs font-medium whitespace-nowrap"
                    style={{
                      color: active ? "var(--brand-primary)" : "var(--brand-text-secondary)",
                    }}
                  >
                    {step.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div
                    className="flex-1 h-1 mx-2 -mt-6 rounded"
                    style={{
                      backgroundColor: i < progressIdx ? "var(--brand-primary)" : "var(--brand-border)",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Items */}
      <div className="rounded-xl p-4 space-y-3" style={{ border: "1px solid var(--brand-border)" }}>
        {order.items.map((it, i) => (
          <div key={i} className="flex justify-between gap-3 text-sm">
            <div>
              <p className="font-semibold" style={{ color: "var(--text-color)" }}>
                {it.qty} × {it.name}
              </p>
              {it.selections.map((g, gi) => (
                <p key={gi} className="text-xs" style={{ color: "var(--brand-text-secondary)" }}>
                  {g.group_name}: {g.options.map((o) => (o.qty > 1 ? `${o.name}×${o.qty}` : o.name)).join(", ")}
                </p>
              ))}
            </div>
            <span className="font-bold shrink-0" style={{ color: "var(--text-color)" }}>
              {formatPrice(it.line_price)}
            </span>
          </div>
        ))}
        <div className="pt-3 space-y-1" style={{ borderTop: "1px solid var(--brand-border)" }}>
          <div className="flex justify-between text-sm">
            <span style={{ color: "var(--brand-text-secondary)" }}>ביניים</span>
            <span>{formatPrice(order.subtotal)}</span>
          </div>
          {order.delivery_fee > 0 && (
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--brand-text-secondary)" }}>משלוח</span>
              <span>{formatPrice(order.delivery_fee)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold">
            <span>סה״כ</span>
            <span style={{ color: "var(--brand-primary)" }}>{formatPrice(order.total)}</span>
          </div>
        </div>
      </div>

      {/* One-click reorder */}
      <button
        onClick={reorder}
        disabled={reorderBusy}
        className="w-full py-3 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-60"
        style={{ border: "2px solid var(--brand-primary)", color: "var(--brand-primary)" }}
      >
        <RotateCcw className="w-4 h-4" />
        {reorderBusy ? "מכין את העגלה..." : "הזמן שוב בקליק"}
      </button>
      {reorderNote && (
        <p className="text-xs text-center" style={{ color: "var(--brand-text-secondary)" }}>
          {reorderNote}
        </p>
      )}
    </div>
  );
}
