"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError("אימייל או סיסמה שגויים");
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    borderRadius: 12,
    border: "1px solid var(--brand-border)",
    backgroundColor: "var(--brand-bg-card)",
  };

  return (
    <div className="max-w-sm mx-auto px-4 py-16 w-full">
      <h1 className="text-2xl font-bold mb-6 text-center" style={{ color: "var(--text-color)" }}>
        כניסת צוות
      </h1>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="אימייל"
          dir="ltr"
          className="w-full p-3 text-sm outline-none"
          style={inputStyle}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="סיסמה"
          dir="ltr"
          className="w-full p-3 text-sm outline-none"
          style={inputStyle}
        />
        {error && (
          <p className="text-sm font-medium" style={{ color: "#DC2626" }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-60"
          style={{ backgroundColor: "var(--brand-primary)" }}
        >
          {busy ? "מתחבר..." : "כניסה"}
        </button>
      </form>
    </div>
  );
}
