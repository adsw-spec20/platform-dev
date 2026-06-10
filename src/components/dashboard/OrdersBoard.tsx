"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LogOut, Bell } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { formatPrice } from "@/lib/format";
import {
  TRANSITIONS,
  STATUS_LABELS,
  type OrderStatus,
} from "@/lib/orders/state";

type DashOrder = {
  id: string;
  number: number;
  status: OrderStatus;
  method: "delivery" | "pickup";
  customer_name: string;
  customer_phone: string;
  address: { street: string; house_number: string; city: string; apartment?: string; floor?: string } | null;
  customer_notes: string | null;
  items: {
    name: string;
    qty: number;
    line_price: number;
    notes: string | null;
    selections: { group_name: string; options: { name: string; qty: number }[] }[];
  }[];
  total: number;
  created_at: string;
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  new: "#DC2626",
  preparing: "#F59E0B",
  ready: "#16A34A",
  out_for_delivery: "#2563EB",
  completed: "#6B7280",
  canceled: "#9CA3AF",
};

/** Live orders board: Realtime under staff RLS; DB trigger enforces transitions. */
export function OrdersBoard() {
  const [orders, setOrders] = useState<DashOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);

  const beep = useCallback(() => {
    try {
      audioCtx.current ??= new AudioContext();
      const ctx = audioCtx.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch {
      /* audio blocked until user interaction - fine */
    }
  }, []);

  const load = useCallback(async () => {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const { data } = await supabaseBrowser()
      .from("orders")
      .select("*")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false });
    setOrders((data as DashOrder[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const supabase = supabaseBrowser();
    const channel = supabase
      .channel("orders-board")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          setOrders((prev) => [payload.new as DashOrder, ...prev]);
          beep();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          setOrders((prev) =>
            prev.map((o) =>
              o.id === (payload.new as DashOrder).id ? (payload.new as DashOrder) : o
            )
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, beep]);

  async function advance(order: DashOrder, to: OrderStatus) {
    setUpdateError(null);
    const { error } = await supabaseBrowser()
      .from("orders")
      .update({ status: to })
      .eq("id", order.id);
    if (error) {
      setUpdateError(`עדכון נכשל: ${error.message}`);
      load(); // resync
    }
  }

  const active = orders.filter(
    (o) => o.status !== "completed" && o.status !== "canceled"
  );
  const done = orders.filter(
    (o) => o.status === "completed" || o.status === "canceled"
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "var(--text-color)" }}>
          <Bell className="w-6 h-6" /> הזמנות היום
        </h1>
        <button
          onClick={() => supabaseBrowser().auth.signOut()}
          className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg hover:opacity-70"
          style={{ border: "1px solid var(--brand-border)", color: "var(--text-color)" }}
        >
          <LogOut className="w-4 h-4" /> יציאה
        </button>
      </div>

      {updateError && (
        <p className="mb-4 text-sm font-medium rounded-xl p-3" style={{ color: "#DC2626", backgroundColor: "#FEF2F2" }}>
          {updateError}
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl animate-pulse bg-black/5" />
          ))}
        </div>
      ) : active.length === 0 && done.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-3">😴</div>
          <p className="font-bold" style={{ color: "var(--text-color)" }}>אין הזמנות היום עדיין</p>
          <p className="text-sm mt-1" style={{ color: "var(--brand-text-secondary)" }}>
            הזמנות חדשות יופיעו כאן אוטומטית עם צליל התראה
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {active.map((o) => (
            <OrderCard key={o.id} order={o} onAdvance={advance} />
          ))}
          {done.length > 0 && (
            <>
              <h2 className="font-bold pt-4" style={{ color: "var(--brand-text-secondary)" }}>
                הסתיימו היום ({done.length})
              </h2>
              {done.map((o) => (
                <OrderCard key={o.id} order={o} onAdvance={advance} muted />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function OrderCard({
  order,
  onAdvance,
  muted,
}: {
  order: DashOrder;
  onAdvance: (o: DashOrder, to: OrderStatus) => void;
  muted?: boolean;
}) {
  const nexts = TRANSITIONS[order.status] ?? [];
  const time = new Date(order.created_at).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className="rounded-xl p-4"
      style={{
        backgroundColor: "var(--brand-bg-card)",
        border: "1px solid var(--brand-border)",
        opacity: muted ? 0.65 : 1,
        boxShadow: muted ? "none" : "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-lg" style={{ color: "var(--text-color)" }}>
              #{order.number}
            </span>
            <span
              className="px-2 py-0.5 rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: STATUS_COLORS[order.status] }}
            >
              {STATUS_LABELS[order.status]}
            </span>
            <span className="text-xs" style={{ color: "var(--brand-text-secondary)" }}>
              {order.method === "delivery" ? "🛵 משלוח" : "🏃 איסוף"} · {time}
            </span>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--text-color)" }}>
            {order.customer_name} · <a href={`tel:${order.customer_phone}`} className="underline">{order.customer_phone}</a>
          </p>
          {order.address && (
            <p className="text-xs mt-0.5" style={{ color: "var(--brand-text-secondary)" }}>
              {order.address.street} {order.address.house_number}, {order.address.city}
              {order.address.apartment ? ` · דירה ${order.address.apartment}` : ""}
              {order.address.floor ? ` · קומה ${order.address.floor}` : ""}
            </p>
          )}
        </div>
        <span className="font-bold text-lg" style={{ color: "var(--brand-primary)" }}>
          {formatPrice(order.total)}
        </span>
      </div>

      {/* Items */}
      <div className="mt-3 space-y-1.5 text-sm" style={{ borderTop: "1px solid var(--brand-border)", paddingTop: 10 }}>
        {order.items.map((it, i) => (
          <div key={i}>
            <span className="font-medium" style={{ color: "var(--text-color)" }}>
              {it.qty} × {it.name}
            </span>
            {it.selections.map((g, gi) => (
              <span key={gi} className="text-xs block ps-4" style={{ color: "var(--brand-text-secondary)" }}>
                {g.group_name}: {g.options.map((o) => (o.qty > 1 ? `${o.name}×${o.qty}` : o.name)).join(", ")}
              </span>
            ))}
            {it.notes && (
              <span className="text-xs block ps-4 font-medium" style={{ color: "#DC2626" }}>
                ✎ {it.notes}
              </span>
            )}
          </div>
        ))}
        {order.customer_notes && (
          <p className="text-xs font-medium pt-1" style={{ color: "#DC2626" }}>
            הערת לקוח: {order.customer_notes}
          </p>
        )}
      </div>

      {/* Actions */}
      {nexts.length > 0 && (
        <div className="flex gap-2 mt-3 flex-wrap">
          {nexts.map((to) => (
            <button
              key={to}
              onClick={() => onAdvance(order, to)}
              className="px-4 py-2 rounded-lg text-sm font-bold text-white active:scale-95 transition-transform"
              style={{
                backgroundColor: to === "canceled" ? "#6B7280" : STATUS_COLORS[to],
              }}
            >
              {to === "canceled" ? "ביטול" : STATUS_LABELS[to]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
