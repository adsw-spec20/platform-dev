"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Crown, Plus, ExternalLink, Pause, Play, Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/browser";

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  custom_domain: string | null;
  status: "trial" | "active" | "past_due" | "suspended";
  created_at: string;
  orders: number;
};

const STATUS_LABEL: Record<TenantRow["status"], { text: string; color: string }> = {
  trial: { text: "ניסיון", color: "#F59E0B" },
  active: { text: "פעיל", color: "#16A34A" },
  past_due: { text: "חוב", color: "#DC2626" },
  suspended: { text: "מושעה", color: "#6B7280" },
};

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabaseBrowser().auth.getSession();
  return { Authorization: `Bearer ${data.session?.access_token ?? ""}` };
}

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [tenants, setTenants] = useState<TenantRow[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const supabase = supabaseBrowser();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const t = setTimeout(() => setReady(true), 4000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/tenants", { headers: await authHeader() });
    if (res.status === 403) {
      setForbidden(true);
      return;
    }
    const data = await res.json();
    setTenants(data.tenants ?? []);
  }, []);

  useEffect(() => {
    if (session) load();
  }, [session, load]);

  async function setStatus(t: TenantRow, status: TenantRow["status"]) {
    await fetch("/api/admin/tenants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ tenant_id: t.id, status }),
    });
    load();
  }

  if (!ready) return <Shell><p className="text-sm text-gray-400 p-10 text-center">טוען...</p></Shell>;

  if (!session) return <Shell><AdminLogin /></Shell>;

  if (forbidden) {
    return (
      <Shell>
        <div className="text-center p-10 space-y-3">
          <p className="font-bold text-gray-800">אין הרשאת ניהול-על לחשבון הזה</p>
          <button onClick={() => supabaseBrowser().auth.signOut()} className="text-sm underline text-gray-500">
            התנתקות
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Crown className="w-6 h-6 text-amber-500" /> ניהול הפלטפורמה
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600"
          >
            <Plus className="w-4 h-4" /> עסק חדש
          </button>
          <button onClick={() => supabaseBrowser().auth.signOut()} className="text-sm underline text-gray-400">
            יציאה
          </button>
        </div>
      </div>

      {tenants === null ? (
        <div className="h-40 rounded-xl animate-pulse bg-gray-100" />
      ) : (
        <div className="space-y-2">
          {tenants.map((t) => {
            const s = STATUS_LABEL[t.status];
            const host = typeof window !== "undefined" ? window.location.host : "";
            return (
              <div key={t.id} className="flex items-center gap-3 p-4 rounded-xl bg-white border border-gray-100 flex-wrap">
                <div className="flex-1 min-w-40">
                  <p className="font-bold text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-400" dir="ltr">
                    {t.custom_domain ?? `${t.slug}.${host}`}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: s.color }}>
                  {s.text}
                </span>
                <span className="text-xs text-gray-500">{t.orders} הזמנות</span>
                <span className="text-xs text-gray-400">
                  {new Date(t.created_at).toLocaleDateString("he-IL")}
                </span>
                <div className="flex items-center gap-2 ms-auto">
                  <a
                    href={`${window.location.protocol}//${t.slug}.${host}`}
                    target="_blank"
                    className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900"
                    aria-label="פתח חנות"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  {t.status !== "suspended" ? (
                    <button
                      onClick={() => setStatus(t, "suspended")}
                      className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-red-600"
                      aria-label="השעה"
                      title="השעה (החנות תוצג כסגורה)"
                    >
                      <Pause className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => setStatus(t, "active")}
                      className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-green-600"
                      aria-label="הפעל"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {tenants.length === 0 && <p className="text-sm text-gray-400">אין עסקים עדיין.</p>}
        </div>
      )}

      {showCreate && <CreateTenantDialog onClose={() => { setShowCreate(false); load(); }} />}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 py-8 px-4" style={{ fontFamily: "'Rubik', sans-serif" }}>
      <div className="max-w-3xl mx-auto">{children}</div>
    </div>
  );
}

function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
    if (error) {
      setError("פרטי התחברות שגויים");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-sm mx-auto bg-white rounded-2xl border border-gray-100 p-6 space-y-3 mt-10">
      <h1 className="text-xl font-bold text-center text-gray-900 flex items-center justify-center gap-2">
        <Crown className="w-5 h-5 text-amber-500" /> כניסת ניהול-על
      </h1>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="אימייל" dir="ltr"
        className="w-full p-3 text-sm rounded-xl border border-gray-200 outline-none" />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="סיסמה" dir="ltr"
        className="w-full p-3 text-sm rounded-xl border border-gray-200 outline-none" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy} className="w-full py-3 rounded-xl font-bold text-white bg-red-600 disabled:opacity-60">
        {busy ? "מתחבר..." : "כניסה"}
      </button>
    </form>
  );
}

function CreateTenantDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ business_name: name, slug, email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error?.message ?? "יצירה נכשלה");
      setBusy(false);
      return;
    }
    onClose();
  }

  const input = "w-full p-3 text-sm rounded-xl border border-gray-200 outline-none";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl p-5 w-full max-w-sm space-y-3">
        <h2 className="font-bold text-gray-900">הקמת עסק (ע״י המנהל)</h2>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="שם העסק" className={input} />
        <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="slug (pizza-roma)" dir="ltr" className={input} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="אימייל הבעלים" dir="ltr" className={input} />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="סיסמה ראשונית" dir="ltr" className={input} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button onClick={create} disabled={busy} className="w-full py-3 rounded-xl font-bold text-white bg-red-600 disabled:opacity-60 flex items-center justify-center gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} צור עסק
        </button>
      </div>
    </div>
  );
}
