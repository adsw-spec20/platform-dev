"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useTenantId } from "@/lib/dashboard/use-tenant-id";

const DAYS: { key: string; label: string }[] = [
  { key: "sunday", label: "ראשון" },
  { key: "monday", label: "שני" },
  { key: "tuesday", label: "שלישי" },
  { key: "wednesday", label: "רביעי" },
  { key: "thursday", label: "חמישי" },
  { key: "friday", label: "שישי" },
  { key: "saturday", label: "שבת" },
];

type Settings = {
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  delivery_fee: number;
  min_order: number;
  prep_minutes: number;
  opening_hours: Record<string, string>;
  operational_status: "auto" | "busy" | "closed";
  busy_extra_minutes: number;
};

export default function SettingsPage() {
  const tenantId = useTenantId();
  const [s, setS] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabaseBrowser()
      .from("tenant_settings")
      .select("*")
      .maybeSingle()
      .then(({ data }) => {
        if (data) setS(data as Settings);
      });
  }, []);

  async function save() {
    if (!s || !tenantId) return;
    for (const d of DAYS) {
      const v = (s.opening_hours[d.key] ?? "").trim().toLowerCase();
      if (v !== "closed" && !/^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(v)) {
        return setError(`שעות לא תקינות ביום ${d.label} — פורמט: 10:00-22:00 או closed`);
      }
    }
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser()
      .from("tenant_settings")
      .update({
        delivery_enabled: s.delivery_enabled,
        pickup_enabled: s.pickup_enabled,
        delivery_fee: s.delivery_fee,
        min_order: s.min_order,
        prep_minutes: s.prep_minutes,
        opening_hours: s.opening_hours,
        operational_status: s.operational_status,
        busy_extra_minutes: s.busy_extra_minutes,
      })
      .eq("tenant_id", tenantId);
    if (error) setError(error.message);
    else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
    setBusy(false);
  }

  if (!s) return <div className="p-6"><div className="h-60 rounded-xl animate-pulse bg-black/5" /></div>;

  const inputStyle: React.CSSProperties = {
    borderRadius: 10,
    border: "1px solid var(--brand-border)",
    backgroundColor: "var(--brand-bg-card)",
    color: "var(--text-color)",
  };
  const card: React.CSSProperties = {
    backgroundColor: "var(--brand-bg-card)",
    border: "1px solid var(--brand-border)",
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold" style={{ color: "var(--text-color)" }}>
        הגדרות העסק
      </h1>

      {/* Operational status */}
      <div className="rounded-xl p-4 space-y-3" style={card}>
        <h2 className="font-bold text-sm" style={{ color: "var(--text-color)" }}>סטטוס העסק עכשיו</h2>
        <div className="flex gap-2">
          {([
            ["auto", "🟢 פתוח (לפי שעות)"],
            ["busy", "🟠 עומס"],
            ["closed", "🔴 סגור"],
          ] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setS({ ...s, operational_status: val })}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold"
              style={{
                backgroundColor: s.operational_status === val ? "var(--brand-primary)" : "var(--brand-bg-card)",
                color: s.operational_status === val ? "#fff" : "var(--text-color)",
                border: s.operational_status === val ? "1px solid transparent" : "1px solid var(--brand-border)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {s.operational_status === "busy" && (
          <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-color)" }}>
            תוספת זמן הכנה בעומס (דקות):
            <input
              type="number" min={0}
              value={s.busy_extra_minutes}
              onChange={(e) => setS({ ...s, busy_extra_minutes: parseInt(e.target.value) || 0 })}
              className="w-20 p-2 outline-none" style={inputStyle}
            />
          </label>
        )}
      </div>

      {/* Delivery & pickup */}
      <div className="rounded-xl p-4 space-y-3" style={card}>
        <h2 className="font-bold text-sm" style={{ color: "var(--text-color)" }}>משלוח ואיסוף</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-color)" }}>
            <input type="checkbox" checked={s.delivery_enabled} onChange={(e) => setS({ ...s, delivery_enabled: e.target.checked })} />
            משלוחים פעילים
          </label>
          <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-color)" }}>
            <input type="checkbox" checked={s.pickup_enabled} onChange={(e) => setS({ ...s, pickup_enabled: e.target.checked })} />
            איסוף עצמי פעיל
          </label>
          <label className="text-sm space-y-1" style={{ color: "var(--text-color)" }}>
            <span>דמי משלוח (₪) — ברירת מחדל*</span>
            <input
              value={(s.delivery_fee / 100).toFixed(2)} dir="ltr" inputMode="decimal"
              onChange={(e) => setS({ ...s, delivery_fee: Math.round((parseFloat(e.target.value) || 0) * 100) })}
              className="w-full p-2 outline-none" style={inputStyle}
            />
          </label>
          <label className="text-sm space-y-1" style={{ color: "var(--text-color)" }}>
            <span>מינימום הזמנה (₪)</span>
            <input
              value={(s.min_order / 100).toFixed(2)} dir="ltr" inputMode="decimal"
              onChange={(e) => setS({ ...s, min_order: Math.round((parseFloat(e.target.value) || 0) * 100) })}
              className="w-full p-2 outline-none" style={inputStyle}
            />
          </label>
          <label className="text-sm space-y-1" style={{ color: "var(--text-color)" }}>
            <span>זמן הכנה ממוצע (דקות)</span>
            <input
              type="number" min={5} value={s.prep_minutes}
              onChange={(e) => setS({ ...s, prep_minutes: parseInt(e.target.value) || 30 })}
              className="w-full p-2 outline-none" style={inputStyle}
            />
          </label>
        </div>
        <p className="text-xs" style={{ color: "var(--brand-text-secondary)" }}>
          * אם מוגדרים אזורי משלוח על המפה — המחיר לפי אזור גובר על ברירת המחדל.
        </p>
      </div>

      {/* Opening hours */}
      <div className="rounded-xl p-4 space-y-2" style={card}>
        <h2 className="font-bold text-sm mb-1" style={{ color: "var(--text-color)" }}>שעות פעילות</h2>
        {DAYS.map((d) => {
          const v = s.opening_hours[d.key] ?? "";
          const closed = v.trim().toLowerCase() === "closed";
          return (
            <div key={d.key} className="flex items-center gap-3">
              <span className="w-14 text-sm" style={{ color: "var(--text-color)" }}>{d.label}</span>
              <input
                value={closed ? "" : v}
                disabled={closed}
                placeholder="10:00-22:00"
                dir="ltr"
                onChange={(e) => setS({ ...s, opening_hours: { ...s.opening_hours, [d.key]: e.target.value } })}
                className="flex-1 p-2 text-sm outline-none disabled:opacity-40"
                style={inputStyle}
              />
              <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--brand-text-secondary)" }}>
                <input
                  type="checkbox"
                  checked={closed}
                  onChange={(e) =>
                    setS({
                      ...s,
                      opening_hours: { ...s.opening_hours, [d.key]: e.target.checked ? "closed" : "10:00-22:00" },
                    })
                  }
                />
                סגור
              </label>
            </div>
          );
        })}
      </div>

      {error && (
        <p className="text-sm rounded-xl p-3" style={{ color: "#DC2626", backgroundColor: "#FEF2F2" }}>
          {error}
        </p>
      )}
      <button
        onClick={save}
        disabled={busy}
        className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-60"
        style={{ backgroundColor: "var(--brand-primary)" }}
      >
        {saved ? "נשמר ✓" : busy ? "שומר..." : "שמירת הגדרות"}
      </button>
    </div>
  );
}
