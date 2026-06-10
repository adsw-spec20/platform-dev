"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/browser";

type StaffRow = {
  id: string;
  email: string;
  role: { key: string; name: string } | null;
  is_me: boolean;
};

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabaseBrowser().auth.getSession();
  return { Authorization: `Bearer ${data.session?.access_token ?? ""}` };
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffRow[] | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("kitchen");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/staff", { headers: await authHeader() });
    if (res.status === 403) return setForbidden(true);
    const data = await res.json();
    setStaff(data.staff ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addStaff() {
    setError(null);
    if (password.length < 8) return setError("סיסמה: לפחות 8 תווים");
    setBusy(true);
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ email: email.trim(), password, role }),
    });
    const data = await res.json();
    if (!res.ok) setError(data?.error?.message ?? "יצירת המשתמש נכשלה");
    else {
      setEmail("");
      setPassword("");
      load();
    }
    setBusy(false);
  }

  async function removeStaff(row: StaffRow) {
    if (!confirm(`להסיר את ${row.email}?`)) return;
    const res = await fetch(`/api/staff/${row.id}`, {
      method: "DELETE",
      headers: await authHeader(),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data?.error?.message ?? "הסרה נכשלה");
    }
    load();
  }

  const inputStyle: React.CSSProperties = {
    borderRadius: 10,
    border: "1px solid var(--brand-border)",
    backgroundColor: "var(--brand-bg-card)",
    color: "var(--text-color)",
  };

  if (forbidden) {
    return (
      <div className="p-6">
        <p className="text-sm" style={{ color: "var(--brand-text-secondary)" }}>
          אין לך הרשאה לנהל צוות (נדרש תפקיד בעלים).
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold" style={{ color: "var(--text-color)" }}>
        צוות והרשאות
      </h1>

      {/* Add staff */}
      <div
        className="rounded-xl p-4 space-y-3"
        style={{ backgroundColor: "var(--brand-bg-card)", border: "1px solid var(--brand-border)" }}
      >
        <h2 className="font-bold text-sm flex items-center gap-2" style={{ color: "var(--text-color)" }}>
          <UserPlus className="w-4 h-4" /> הוספת איש צוות
        </h2>
        <div className="grid sm:grid-cols-3 gap-2">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="אימייל" dir="ltr" className="p-2.5 text-sm outline-none" style={inputStyle} />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="סיסמה (8+ תווים)" dir="ltr" className="p-2.5 text-sm outline-none" style={inputStyle} />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="p-2.5 text-sm outline-none" style={inputStyle}>
            <option value="manager">מנהל</option>
            <option value="kitchen">מטבח</option>
            <option value="delivery">שליח</option>
            <option value="owner">בעלים</option>
          </select>
        </div>
        {error && <p className="text-sm" style={{ color: "#DC2626" }}>{error}</p>}
        <button
          onClick={addStaff}
          disabled={busy}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
          style={{ backgroundColor: "var(--brand-primary)" }}
        >
          {busy ? "יוצר..." : "צור משתמש"}
        </button>
        <p className="text-xs" style={{ color: "var(--brand-text-secondary)" }}>
          מטבח רואה את לוח ההזמנות בלבד · מנהל מנהל הכל מלבד צוות · בעלים שולט בהכל.
        </p>
      </div>

      {/* List */}
      <div className="space-y-2">
        {staff === null ? (
          <div className="h-24 rounded-xl animate-pulse bg-black/5" />
        ) : (
          staff.map((row) => (
            <div
              key={row.id}
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ backgroundColor: "var(--brand-bg-card)", border: "1px solid var(--brand-border)" }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" dir="ltr" style={{ color: "var(--text-color)", textAlign: "right" }}>
                  {row.email} {row.is_me && <span className="text-xs">(את/ה)</span>}
                </p>
              </div>
              <span
                className="px-2.5 py-1 rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: row.role?.key === "owner" ? "var(--brand-primary)" : "#6B7280" }}
              >
                {row.role?.name ?? "—"}
              </span>
              {!row.is_me && (
                <button onClick={() => removeStaff(row)} aria-label="הסרה" style={{ color: "#DC2626" }}>
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
