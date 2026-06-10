"use client";

import { useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useTenantId } from "@/lib/dashboard/use-tenant-id";

const FONTS = [
  "Rubik", "Heebo", "Assistant", "Secular One", "Varela Round",
  "Miriam Libre", "Noto Sans Hebrew", "IBM Plex Sans Hebrew", "Frank Ruhl Libre",
];

type ThemeDraft = {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  font_family: string;
  logo_url: string | null;
};

export default function BrandingPage() {
  const tenantId = useTenantId();
  const [theme, setTheme] = useState<ThemeDraft | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabaseBrowser()
      .from("themes")
      .select("primary_color, secondary_color, accent_color, background_color, text_color, font_family, logo_url")
      .maybeSingle()
      .then(({ data }) => {
        if (data) setTheme(data);
      });
  }, []);

  async function uploadLogo(file: File) {
    if (!tenantId || !theme) return;
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${tenantId}/branding/logo-${Date.now()}.${ext}`;
    const db = supabaseBrowser();
    const { error } = await db.storage.from("public-assets").upload(path, file);
    if (error) setError(`העלאה נכשלה: ${error.message}`);
    else {
      const { data } = db.storage.from("public-assets").getPublicUrl(path);
      setTheme({ ...theme, logo_url: data.publicUrl });
    }
    setUploading(false);
  }

  async function save() {
    if (!theme || !tenantId) return;
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser()
      .from("themes")
      .update(theme)
      .eq("tenant_id", tenantId);
    if (error) setError(error.message);
    else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
    setBusy(false);
  }

  if (!theme) return <div className="p-6"><div className="h-60 rounded-xl animate-pulse bg-black/5" /></div>;

  const colorField = (label: string, key: keyof ThemeDraft) => (
    <label className="flex items-center justify-between gap-3 text-sm" style={{ color: "var(--text-color)" }}>
      {label}
      <input
        type="color"
        value={theme[key] as string}
        onChange={(e) => setTheme({ ...theme, [key]: e.target.value })}
        className="w-14 h-9 rounded cursor-pointer border-0 bg-transparent"
      />
    </label>
  );

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-5" style={{ color: "var(--text-color)" }}>
        מיתוג
      </h1>
      <div className="grid md:grid-cols-2 gap-6">
        {/* Controls */}
        <div
          className="rounded-xl p-4 space-y-4 self-start"
          style={{ backgroundColor: "var(--brand-bg-card)", border: "1px solid var(--brand-border)" }}
        >
          {colorField("צבע ראשי (כפתורים, מחירים)", "primary_color")}
          {colorField("צבע משני (פוטר)", "secondary_color")}
          {colorField("צבע הדגשה (תגיות)", "accent_color")}
          {colorField("צבע רקע", "background_color")}
          {colorField("צבע טקסט", "text_color")}
          <label className="flex items-center justify-between gap-3 text-sm" style={{ color: "var(--text-color)" }}>
            גופן
            <select
              value={theme.font_family}
              onChange={(e) => setTheme({ ...theme, font_family: e.target.value })}
              className="p-2 text-sm outline-none rounded-lg"
              style={{ border: "1px solid var(--brand-border)", backgroundColor: "var(--brand-bg-card)", color: "var(--text-color)" }}
            >
              {FONTS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </label>
          <div className="flex items-center justify-between gap-3 text-sm" style={{ color: "var(--text-color)" }}>
            לוגו
            <label
              className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-xs"
              style={{ border: "1px dashed var(--brand-border)", color: "var(--brand-text-secondary)" }}
            >
              {uploading ? "מעלה..." : (<><Upload className="w-4 h-4" /> העלאה</>)}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} />
            </label>
          </div>
          {theme.logo_url && (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={theme.logo_url} alt="לוגו" className="h-10" />
              <button onClick={() => setTheme({ ...theme, logo_url: null })} className="text-xs underline" style={{ color: "var(--brand-text-secondary)" }}>
                הסר
              </button>
            </div>
          )}

          {error && <p className="text-sm" style={{ color: "#DC2626" }}>{error}</p>}
          <button
            onClick={save}
            disabled={busy}
            className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-60"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            {saved ? "נשמר ✓" : busy ? "שומר..." : "שמירת מיתוג"}
          </button>
          <p className="text-xs" style={{ color: "var(--brand-text-secondary)" }}>
            השינויים נכנסים לתוקף בחנות מיד לאחר השמירה (רענון עמוד).
          </p>
        </div>

        {/* Live preview */}
        <div
          className="rounded-xl overflow-hidden self-start"
          style={{ border: "1px solid var(--brand-border)" }}
        >
          <div className="px-3 py-2 text-xs font-medium" style={{ backgroundColor: "var(--brand-bg-card)", color: "var(--brand-text-secondary)", borderBottom: "1px solid var(--brand-border)" }}>
            תצוגה מקדימה חיה
          </div>
          <div style={{ backgroundColor: theme.background_color, fontFamily: `'${theme.font_family}', sans-serif` }} className="p-4 space-y-3">
            <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb" }}>
              {theme.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={theme.logo_url} alt="" className="h-6" />
              ) : (
                <span className="font-bold text-sm" style={{ color: theme.primary_color }}>שם העסק</span>
              )}
              <span className="w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center text-white" style={{ backgroundColor: theme.accent_color }}>2</span>
            </div>
            <div className="flex gap-2">
              <span className="px-3 py-1.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: theme.primary_color }}>בורגרים</span>
              <span className="px-3 py-1.5 rounded-full text-xs" style={{ backgroundColor: "#fff", color: theme.text_color, border: "1px solid #e5e7eb" }}>תוספות</span>
            </div>
            <div className="flex gap-3 rounded-xl p-3" style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb" }}>
              <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center">🍔</div>
              <div className="flex-1">
                <p className="font-semibold text-sm" style={{ color: theme.text_color }}>המבורגר הבית</p>
                <p className="text-xs" style={{ color: "rgba(31,41,55,0.55)" }}>עם תוספות לבחירה</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-bold" style={{ color: theme.primary_color }}>₪52.00</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] text-white" style={{ backgroundColor: theme.accent_color }}>הכי נמכר!</span>
                </div>
              </div>
            </div>
            <button className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ backgroundColor: theme.primary_color }}>
              מעבר לתשלום · ₪52.00
            </button>
            <div className="rounded-lg py-2 text-center text-xs text-white" style={{ backgroundColor: theme.secondary_color }}>
              פוטר החנות
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
