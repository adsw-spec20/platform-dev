"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2, Copy, Zap, RefreshCw } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Endpoint = {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
};
type Delivery = {
  id: string;
  event: string;
  status: string;
  attempts: number;
  last_status_code: number | null;
  last_error: string | null;
  created_at: string;
};

const ALL_EVENTS = [
  { key: "order.created", label: "הזמנה חדשה" },
  { key: "order.status_changed", label: "שינוי סטטוס" },
  { key: "order.cancelled", label: "ביטול הזמנה" },
];

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabaseBrowser().auth.getSession();
  return { Authorization: `Bearer ${data.session?.access_token ?? ""}` };
}

export default function IntegrationsPage() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["order.created"]);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    const db = supabaseBrowser();
    const [{ data: eps }, { data: dels }] = await Promise.all([
      db.from("webhook_endpoints").select("id, url, events, is_active").order("created_at"),
      db.from("webhook_deliveries")
        .select("id, event, status, attempts, last_status_code, last_error, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    setEndpoints((eps as Endpoint[]) ?? []);
    setDeliveries((dels as Delivery[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addEndpoint() {
    setError(null);
    setBusy(true);
    const res = await fetch("/api/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ url: url.trim(), events }),
    });
    const data = await res.json();
    if (!res.ok) setError(data?.error?.message ?? "הוספה נכשלה — ודא שכתובת ה-URL תקינה");
    else {
      setNewSecret(data.endpoint.secret);
      setUrl("");
      load();
    }
    setBusy(false);
  }

  async function removeEndpoint(ep: Endpoint) {
    if (!confirm("למחוק את החיבור? שליחות עתידיות אליו יפסיקו.")) return;
    await supabaseBrowser().from("webhook_endpoints").delete().eq("id", ep.id);
    load();
  }

  async function toggleEndpoint(ep: Endpoint) {
    await supabaseBrowser()
      .from("webhook_endpoints")
      .update({ is_active: !ep.is_active })
      .eq("id", ep.id);
    load();
  }

  async function testEndpoint(ep: Endpoint) {
    setTestResult("שולח בדיקה...");
    const res = await fetch("/api/webhooks/test", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ endpoint_id: ep.id }),
    });
    const data = await res.json();
    const r = data?.result;
    setTestResult(
      r?.status === "delivered"
        ? `✅ נשלח בהצלחה (HTTP ${r.last_status_code})`
        : `❌ נכשל: ${r?.last_error ?? "שגיאה"} — ננסה שוב אוטומטית`
    );
    load();
  }

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
    <div className="p-4 md:p-6 max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold" style={{ color: "var(--text-color)" }}>
        חיבורים (Webhooks)
      </h1>
      <p className="text-sm" style={{ color: "var(--brand-text-secondary)" }}>
        כל הזמנה חדשה ושינוי סטטוס נשלחים אוטומטית לכתובת שתגדיר — מדפסת תרמית,
        קופה, Make / Zapier, או כל מערכת שמדברת HTTP. כל שליחה חתומה
        (HMAC-SHA256, כותרת <code dir="ltr">X-Platform-Signature</code>).
      </p>

      {newSecret && (
        <div className="rounded-xl p-4 space-y-2" style={{ ...card, borderColor: "#16A34A" }}>
          <p className="text-sm font-bold" style={{ color: "#16A34A" }}>
            החיבור נוצר! שמור את המפתח הסודי — הוא מוצג פעם אחת בלבד:
          </p>
          <div className="flex items-center gap-2">
            <code dir="ltr" className="flex-1 text-xs p-2 rounded-lg overflow-x-auto" style={{ backgroundColor: "rgba(0,0,0,0.05)" }}>
              {newSecret}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(newSecret)}
              aria-label="העתקה"
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ border: "1px solid var(--brand-border)", color: "var(--text-color)" }}
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <button onClick={() => setNewSecret(null)} className="text-xs underline" style={{ color: "var(--brand-text-secondary)" }}>
            שמרתי, אפשר להסתיר
          </button>
        </div>
      )}

      {/* Add endpoint */}
      <div className="rounded-xl p-4 space-y-3" style={card}>
        <h2 className="font-bold text-sm" style={{ color: "var(--text-color)" }}>חיבור חדש</h2>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/webhook"
          dir="ltr"
          className="w-full p-2.5 text-sm outline-none"
          style={inputStyle}
        />
        <div className="flex flex-wrap gap-3">
          {ALL_EVENTS.map((ev) => (
            <label key={ev.key} className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-color)" }}>
              <input
                type="checkbox"
                checked={events.includes(ev.key)}
                onChange={(e) =>
                  setEvents((p) => (e.target.checked ? [...p, ev.key] : p.filter((x) => x !== ev.key)))
                }
              />
              {ev.label}
            </label>
          ))}
        </div>
        {error && <p className="text-sm" style={{ color: "#DC2626" }}>{error}</p>}
        <button
          onClick={addEndpoint}
          disabled={busy || !url.trim() || events.length === 0}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--brand-primary)" }}
        >
          {busy ? "יוצר..." : "צור חיבור"}
        </button>
      </div>

      {/* Endpoints list */}
      {endpoints.map((ep) => (
        <div key={ep.id} className="flex items-center gap-3 p-3 rounded-xl flex-wrap" style={{ ...card, opacity: ep.is_active ? 1 : 0.55 }}>
          <code dir="ltr" className="flex-1 min-w-40 text-xs truncate" style={{ color: "var(--text-color)" }}>
            {ep.url}
          </code>
          <span className="text-xs" style={{ color: "var(--brand-text-secondary)" }}>
            {ep.events.length} אירועים
          </span>
          <button onClick={() => testEndpoint(ep)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ backgroundColor: "#2563EB" }}>
            <Zap className="w-3.5 h-3.5" /> בדיקה
          </button>
          <button onClick={() => toggleEndpoint(ep)} className="px-3 py-1.5 rounded-lg text-xs" style={{ border: "1px solid var(--brand-border)", color: "var(--text-color)" }}>
            {ep.is_active ? "השבת" : "הפעל"}
          </button>
          <button onClick={() => removeEndpoint(ep)} aria-label="מחיקה" style={{ color: "#DC2626" }}>
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      {testResult && (
        <p className="text-sm font-medium" style={{ color: "var(--text-color)" }}>{testResult}</p>
      )}

      {/* Deliveries log */}
      {deliveries.length > 0 && (
        <div className="rounded-xl p-4 space-y-2" style={card}>
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm" style={{ color: "var(--text-color)" }}>שליחות אחרונות</h2>
            <button onClick={load} aria-label="רענון" className="opacity-60 hover:opacity-100" style={{ color: "var(--text-color)" }}>
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          {deliveries.map((d) => (
            <div key={d.id} className="flex items-center gap-2 text-xs" style={{ color: "var(--brand-text-secondary)" }}>
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  backgroundColor:
                    d.status === "delivered" ? "#16A34A" : d.status === "abandoned" ? "#DC2626" : "#F59E0B",
                }}
              />
              <span className="font-medium" style={{ color: "var(--text-color)" }}>{d.event}</span>
              <span>{d.status}{d.last_status_code ? ` (${d.last_status_code})` : ""}</span>
              <span>ניסיונות: {d.attempts}</span>
              <span className="ms-auto">{new Date(d.created_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
