"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Eye, EyeOff, Ticket } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useTenantId } from "@/lib/dashboard/use-tenant-id";
import { formatPrice } from "@/lib/format";

type Coupon = {
  id: string;
  code: string;
  kind: "percent" | "fixed";
  value: number;
  min_subtotal: number;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
};

export default function CouponsPage() {
  const tenantId = useTenantId();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("10");
  const [minSubtotal, setMinSubtotal] = useState("0");
  const [maxUses, setMaxUses] = useState("");
  const [expires, setExpires] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabaseBrowser()
      .from("coupons").select("*").order("created_at", { ascending: false });
    setCoupons((data as Coupon[]) ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create() {
    setError(null);
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,40}$/.test(normalized)) return setError("קוד: אותיות לטיניות/ספרות בלבד");
    const v = parseFloat(value);
    if (!Number.isFinite(v) || v <= 0) return setError("ערך לא תקין");
    if (kind === "percent" && v > 100) return setError("אחוז מקסימלי: 100");

    const { error } = await supabaseBrowser().from("coupons").insert({
      tenant_id: tenantId,
      code: normalized,
      kind,
      value: kind === "percent" ? Math.round(v) : Math.round(v * 100),
      min_subtotal: Math.round((parseFloat(minSubtotal) || 0) * 100),
      max_uses: maxUses.trim() === "" ? null : Math.max(1, parseInt(maxUses)),
      expires_at: expires ? new Date(expires + "T23:59:59").toISOString() : null,
    });
    if (error) {
      setError(error.message.includes("duplicate") ? "קוד זה כבר קיים" : error.message);
      return;
    }
    setCode(""); setValue("10"); setMinSubtotal("0"); setMaxUses(""); setExpires("");
    load();
  }

  async function toggle(c: Coupon) {
    await supabaseBrowser().from("coupons").update({ is_active: !c.is_active }).eq("id", c.id);
    load();
  }
  async function remove(c: Coupon) {
    if (!confirm(`למחוק את הקופון ${c.code}?`)) return;
    await supabaseBrowser().from("coupons").delete().eq("id", c.id);
    load();
  }

  const inputStyle: React.CSSProperties = {
    borderRadius: 10,
    border: "1px solid var(--brand-border)",
    backgroundColor: "var(--brand-bg-card)",
    color: "var(--text-color)",
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "var(--text-color)" }}>
        <Ticket className="w-6 h-6" /> קופונים
      </h1>

      <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "var(--brand-bg-card)", border: "1px solid var(--brand-border)" }}>
        <div className="grid sm:grid-cols-3 gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="קוד (SUMMER10)" dir="ltr" className="p-2.5 text-sm outline-none" style={inputStyle} />
          <select value={kind} onChange={(e) => setKind(e.target.value as "percent" | "fixed")} className="p-2.5 text-sm outline-none" style={inputStyle}>
            <option value="percent">% הנחה</option>
            <option value="fixed">₪ הנחה</option>
          </select>
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={kind === "percent" ? "10 (%)" : "20 (₪)"} dir="ltr" inputMode="decimal" className="p-2.5 text-sm outline-none" style={inputStyle} />
          <input value={minSubtotal} onChange={(e) => setMinSubtotal(e.target.value)} placeholder="מינימום הזמנה ₪ (0)" dir="ltr" inputMode="decimal" className="p-2.5 text-sm outline-none" style={inputStyle} />
          <input value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="מקס׳ שימושים (ריק=∞)" dir="ltr" inputMode="numeric" className="p-2.5 text-sm outline-none" style={inputStyle} />
          <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className="p-2.5 text-sm outline-none" style={inputStyle} />
        </div>
        {error && <p className="text-sm" style={{ color: "#DC2626" }}>{error}</p>}
        <button onClick={create} className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white" style={{ backgroundColor: "var(--brand-primary)" }}>
          <Plus className="w-4 h-4" /> צור קופון
        </button>
      </div>

      <div className="space-y-2">
        {coupons.map((c) => (
          <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl flex-wrap"
            style={{ backgroundColor: "var(--brand-bg-card)", border: "1px solid var(--brand-border)", opacity: c.is_active ? 1 : 0.55 }}>
            <code className="font-bold text-sm px-2 py-1 rounded" style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary) 10%, transparent)", color: "var(--brand-primary)" }}>
              {c.code}
            </code>
            <span className="text-sm font-medium" style={{ color: "var(--text-color)" }}>
              {c.kind === "percent" ? `${c.value}% הנחה` : `${formatPrice(c.value)} הנחה`}
            </span>
            <span className="text-xs" style={{ color: "var(--brand-text-secondary)" }}>
              {c.min_subtotal > 0 && `מ-${formatPrice(c.min_subtotal)} · `}
              שומש {c.used_count}{c.max_uses ? `/${c.max_uses}` : ""}
              {c.expires_at && ` · עד ${new Date(c.expires_at).toLocaleDateString("he-IL")}`}
            </span>
            <div className="ms-auto flex items-center gap-2">
              <button onClick={() => toggle(c)} aria-label="הפעל/השבת" className="opacity-60 hover:opacity-100" style={{ color: "var(--text-color)" }}>
                {c.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              <button onClick={() => remove(c)} aria-label="מחיקה" style={{ color: "#DC2626" }}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {coupons.length === 0 && (
          <p className="text-sm" style={{ color: "var(--brand-text-secondary)" }}>אין קופונים עדיין.</p>
        )}
      </div>
    </div>
  );
}
