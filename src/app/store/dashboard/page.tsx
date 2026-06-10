"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { OrdersBoard } from "@/components/dashboard/OrdersBoard";

/** Staff dashboard entry: email+password auth gate -> live orders board. */
export default function DashboardPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = supabaseBrowser();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) {
    return <div className="p-12 text-center text-sm">טוען...</div>;
  }
  return session ? <OrdersBoard /> : <LoginForm />;
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  const submit = useCallback(async () => {
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
  }, [email, password]);

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
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
          ref={emailRef}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="אימייל"
          dir="ltr"
          className="w-full p-3 text-sm outline-none"
          style={{
            borderRadius: 12,
            border: "1px solid var(--brand-border)",
            backgroundColor: "var(--brand-bg-card)",
          }}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="סיסמה"
          dir="ltr"
          className="w-full p-3 text-sm outline-none"
          style={{
            borderRadius: 12,
            border: "1px solid var(--brand-border)",
            backgroundColor: "var(--brand-bg-card)",
          }}
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
