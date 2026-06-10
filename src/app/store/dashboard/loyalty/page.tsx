"use client";

import { useCallback, useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useTenantId } from "@/lib/dashboard/use-tenant-id";
import { formatPrice } from "@/lib/format";

type LoyaltyMember = {
  id: string;
  phone: string;
  balance: number;
  updated_at: string;
};

export default function LoyaltyPage() {
  const tenantId = useTenantId();
  const [enabled, setEnabled] = useState(false);
  const [percent, setPercent] = useState("5");
  const [mode, setMode] = useState<"free_redemption" | "full_item_redemption">("free_redemption");
  const [members, setMembers] = useState<LoyaltyMember[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const db = supabaseBrowser();
    const [{ data: settings }, { data: accounts }] = await Promise.all([
      db.from("tenant_settings")
        .select("loyalty_enabled, loyalty_accrual_percent, loyalty_redemption_mode")
        .maybeSingle(),
      db.from("loyalty_accounts").select("id, phone, balance, updated_at")
        .order("balance", { ascending: false }).limit(100),
    ]);
    if (settings) {
      setEnabled(settings.loyalty_enabled);
      setPercent(String(settings.loyalty_accrual_percent));
      setMode(settings.loyalty_redemption_mode);
    }
    setMembers((accounts as LoyaltyMember[]) ?? []);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setError(null);
    const p = parseFloat(percent);
    if (!Number.isFinite(p) || p < 0 || p > 50) return setError("אחוז צבירה: 0-50");
    const { error } = await supabaseBrowser()
      .from("tenant_settings")
      .update({
        loyalty_enabled: enabled,
        loyalty_accrual_percent: p,
        loyalty_redemption_mode: mode,
      })
      .eq("tenant_id", tenantId);
    if (error) setError(error.message);
    else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  if (!loaded) return <div className="p-6"><div className="h-60 rounded-xl animate-pulse bg-black/5" /></div>;

  const card: React.CSSProperties = {
    backgroundColor: "var(--brand-bg-card)",
    border: "1px solid var(--brand-border)",
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "var(--text-color)" }}>
        <Gift className="w-6 h-6" /> מועדון לקוחות
      </h1>

      <div className="rounded-xl p-4 space-y-4" style={card}>
        <label className="flex items-center gap-3 text-sm font-bold" style={{ color: "var(--text-color)" }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          המועדון פעיל
        </label>

        <label className="flex items-center gap-3 text-sm" style={{ color: "var(--text-color)" }}>
          צבירה: על כל הזמנה הלקוח צובר
          <input
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            dir="ltr" inputMode="decimal"
            className="w-16 p-2 text-sm outline-none text-center"
            style={{ borderRadius: 10, border: "1px solid var(--brand-border)", backgroundColor: "var(--brand-bg-card)", color: "var(--text-color)" }}
          />
          % מהסכום
        </label>

        <div className="space-y-2">
          <p className="text-sm font-bold" style={{ color: "var(--text-color)" }}>אופן מימוש הנקודות:</p>
          <label className="flex items-start gap-2 text-sm cursor-pointer" style={{ color: "var(--text-color)" }}>
            <input type="radio" checked={mode === "free_redemption"} onChange={() => setMode("free_redemption")} className="mt-1" />
            <span>
              <b>מימוש חופשי</b> — נקודות = כסף. צבר ₪5? מוריד ₪5 מכל פריט, גם מפריט של ₪50.
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm cursor-pointer" style={{ color: "var(--text-color)" }}>
            <input type="radio" checked={mode === "full_item_redemption"} onChange={() => setMode("full_item_redemption")} className="mt-1" />
            <span>
              <b>פריטים מלאים בלבד</b> — מימוש רק על פריט שהיתרה מכסה במלואו. יתרה של ₪70 עם פריטים
              ב-₪40/₪50/₪10? אפשר לממש 50+10 או 40+10 — אף פעם לא ״חלק מפריט״.
            </span>
          </label>
        </div>

        {error && <p className="text-sm" style={{ color: "#DC2626" }}>{error}</p>}
        <button onClick={save} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white" style={{ backgroundColor: "var(--brand-primary)" }}>
          {saved ? "נשמר ✓" : "שמירה"}
        </button>
      </div>

      <div className="rounded-xl p-4" style={card}>
        <h2 className="font-bold text-sm mb-3" style={{ color: "var(--text-color)" }}>
          חברי מועדון ({members.length})
        </h2>
        {members.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--brand-text-secondary)" }}>
            עדיין אין חברים — נקודות נצברות אוטומטית בכל הזמנה כשהמועדון פעיל.
          </p>
        ) : (
          <div className="space-y-1.5">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm py-1.5"
                style={{ borderBottom: "1px solid var(--brand-border)" }}>
                <span dir="ltr" style={{ color: "var(--text-color)" }}>{m.phone}</span>
                <span className="font-bold" style={{ color: "var(--brand-primary)" }}>
                  {formatPrice(m.balance)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
