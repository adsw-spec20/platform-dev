"use client";

import { useState } from "react";
import { Download, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Preview = {
  venue_slug: string;
  categories: { name: string; items: number }[];
  item_count: number;
  group_count: number;
  warnings: string[];
  sample: { name: string; price: number; groups: number; has_image: boolean }[];
};

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabaseBrowser().auth.getSession();
  return { Authorization: `Bearer ${data.session?.access_token ?? ""}` };
}

export default function WoltImportPage() {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<"preview" | "commit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ categories: number; items: number } | null>(null);

  async function run(mode: "preview" | "commit") {
    setBusy(mode);
    setError(null);
    if (mode === "preview") setDone(null);
    try {
      const res = await fetch("/api/wolt-import", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ url: url.trim(), mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "הייבוא נכשל");
      } else if (mode === "preview") {
        setPreview(data.preview);
      } else {
        setDone(data.imported);
        setPreview(null);
      }
    } catch {
      setError("שגיאת תקשורת");
    }
    setBusy(null);
  }

  const card: React.CSSProperties = {
    backgroundColor: "var(--brand-bg-card)",
    border: "1px solid var(--brand-border)",
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "var(--text-color)" }}>
        <Download className="w-6 h-6" /> ייבוא תפריט מ-Wolt
      </h1>
      <p className="text-sm" style={{ color: "var(--brand-text-secondary)" }}>
        מדביקים קישור לעמוד המסעדה שלכם ב-Wolt — ואנחנו מייבאים הכל: קטגוריות, מנות,
        מחירים, תמונות וקבוצות תוספות כולל כללי ״חינם״.
      </p>

      <div className="rounded-xl p-4 space-y-3" style={card}>
        <input
          value={url}
          onChange={(e) => { setUrl(e.target.value); setPreview(null); setDone(null); }}
          placeholder="https://wolt.com/he/isr/tel-aviv/restaurant/your-place"
          dir="ltr"
          className="w-full p-3 text-sm outline-none"
          style={{ borderRadius: 12, border: "1px solid var(--brand-border)", backgroundColor: "var(--brand-bg-card)", color: "var(--text-color)" }}
        />
        <button
          onClick={() => run("preview")}
          disabled={busy !== null || !url.trim()}
          className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ backgroundColor: "var(--brand-primary)" }}
        >
          {busy === "preview" ? (<><Loader2 className="w-4 h-4 animate-spin" /> מושך תפריט...</>) : "תצוגה מקדימה"}
        </button>
        {error && (
          <p className="text-sm rounded-xl p-3" style={{ color: "#DC2626", backgroundColor: "#FEF2F2" }}>{error}</p>
        )}
      </div>

      {preview && (
        <div className="rounded-xl p-4 space-y-3" style={card}>
          <p className="font-bold text-sm" style={{ color: "var(--text-color)" }}>
            נמצאו {preview.item_count} מנות ב-{preview.categories.length} קטגוריות
            ({preview.group_count} קבוצות תוספות):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {preview.categories.map((c) => (
              <span key={c.name} className="px-2.5 py-1 rounded-full text-xs"
                style={{ border: "1px solid var(--brand-border)", color: "var(--text-color)" }}>
                {c.name} · {c.items}
              </span>
            ))}
          </div>
          <div className="text-xs space-y-1" style={{ color: "var(--brand-text-secondary)" }}>
            {preview.sample.map((s) => (
              <p key={s.name}>
                {s.name} — ₪{(s.price / 100).toFixed(2)} · {s.groups} קבוצות {s.has_image ? "· 📷" : ""}
              </p>
            ))}
          </div>
          {preview.warnings.map((w) => (
            <p key={w} className="text-xs flex items-center gap-1.5" style={{ color: "#F59E0B" }}>
              <AlertTriangle className="w-3.5 h-3.5" /> {w}
            </p>
          ))}
          <div className="rounded-xl p-3 text-xs" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
            ⚠️ הייבוא <b>מחליף</b> את כל התפריט הקיים שלכם.
          </div>
          <button
            onClick={() => run("commit")}
            disabled={busy !== null}
            className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: "#16A34A" }}
          >
            {busy === "commit" ? (<><Loader2 className="w-4 h-4 animate-spin" /> מייבא...</>) : `ייבא ${preview.item_count} מנות עכשיו`}
          </button>
        </div>
      )}

      {done && (
        <div className="rounded-xl p-4 flex items-center gap-3" style={{ ...card, borderColor: "#16A34A" }}>
          <CheckCircle2 className="w-6 h-6 shrink-0" style={{ color: "#16A34A" }} />
          <p className="text-sm font-medium" style={{ color: "var(--text-color)" }}>
            יובאו {done.items} מנות ב-{done.categories} קטגוריות! התפריט שלכם באוויר —{" "}
            <a href="/" className="underline">צפו בחנות</a> או{" "}
            <a href="/dashboard/menu" className="underline">ערכו בתפריט</a>.
          </p>
        </div>
      )}
    </div>
  );
}
