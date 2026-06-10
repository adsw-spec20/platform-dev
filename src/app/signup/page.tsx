"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Store, User, Palette, Rocket } from "lucide-react";

const PRIMARY = "#DC2626";

const STEPS = [
  { label: "העסק", Icon: Store },
  { label: "חשבון", Icon: User },
  { label: "מיתוג", Icon: Palette },
  { label: "באוויר", Icon: Rocket },
];

export default function SignupWizard() {
  const [step, setStep] = useState(0);
  const [businessName, setBusinessName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "free" | "taken">("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [color, setColor] = useState(PRIMARY);
  const [sampleMenu, setSampleMenu] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ slug: string } | null>(null);
  const slugTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live slug availability
  useEffect(() => {
    const s = slug.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,48}$/.test(s)) {
      setSlugStatus("idle");
      return;
    }
    setSlugStatus("checking");
    if (slugTimer.current) clearTimeout(slugTimer.current);
    slugTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/signup?slug=${s}`);
        const data = await res.json();
        setSlugStatus(data.available ? "free" : "taken");
      } catch {
        setSlugStatus("idle");
      }
    }, 500);
  }, [slug]);

  const host = typeof window !== "undefined" ? window.location.host : "";
  const storeUrl = (s: string) => `${window.location.protocol}//${s}.${host}`;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: businessName.trim(),
          slug: slug.trim().toLowerCase(),
          email: email.trim(),
          password,
          primary_color: color,
          seed_sample_menu: sampleMenu,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "ההרשמה נכשלה, נסו שוב");
        setBusy(false);
        return;
      }
      setDone({ slug: data.slug });
      setStep(3);
    } catch {
      setError("שגיאת תקשורת");
    }
    setBusy(false);
  }

  const input =
    "w-full p-3 text-sm rounded-xl border border-gray-200 outline-none focus:border-red-400 bg-white";

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 py-10 px-4" style={{ fontFamily: "'Rubik', sans-serif" }}>
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-center text-gray-900">פתיחת חנות חדשה</h1>
        <p className="text-sm text-center text-gray-500 mt-1 mb-6">כמה דקות ואתם באוויר 🚀</p>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-1 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.label} className="flex items-center">
              <div className="flex flex-col items-center w-16">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white"
                  style={{ backgroundColor: i <= step ? PRIMARY : "#D1D5DB" }}
                >
                  {i < step ? <Check className="w-4 h-4" /> : <s.Icon className="w-4 h-4" />}
                </div>
                <span className="text-[11px] mt-1 font-medium" style={{ color: i <= step ? PRIMARY : "#9CA3AF" }}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="w-6 h-0.5 -mt-4" style={{ backgroundColor: i < step ? PRIMARY : "#D1D5DB" }} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          {step === 0 && (
            <>
              <input
                value={businessName}
                onChange={(e) => {
                  setBusinessName(e.target.value);
                  if (!slugTouched) {
                    const auto = e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9\s-]/g, "")
                      .trim()
                      .replace(/\s+/g, "-")
                      .slice(0, 30);
                    setSlug(auto);
                  }
                }}
                placeholder="שם העסק (למשל: פיצה רומא)"
                className={input}
              />
              <div>
                <div className="flex items-center gap-2" dir="ltr">
                  <input
                    value={slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(e.target.value.toLowerCase());
                    }}
                    placeholder="pizza-roma"
                    className={`${input} text-left flex-1`}
                  />
                  <span className="text-xs text-gray-400 whitespace-nowrap">.{host}</span>
                </div>
                <p className="text-xs mt-1 h-4">
                  {slugStatus === "checking" && <span className="text-gray-400">בודק זמינות...</span>}
                  {slugStatus === "free" && <span className="text-green-600">✓ הכתובת פנויה</span>}
                  {slugStatus === "taken" && <span className="text-red-600">✗ תפוס — נסו שם אחר</span>}
                  {slugStatus === "idle" && slug && <span className="text-gray-400">אותיות באנגלית, ספרות ומקפים</span>}
                </p>
                <p className="text-xs text-gray-400">זו כתובת זמנית לעבודה — דומיין משלכם מתחברים בדשבורד.</p>
              </div>
              <WizardNext
                disabled={businessName.trim().length < 2 || slugStatus !== "free"}
                onClick={() => setStep(1)}
              />
            </>
          )}

          {step === 1 && (
            <>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="אימייל (כניסה לניהול)" dir="ltr" className={input} />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="סיסמה (8+ תווים)" dir="ltr" className={input} />
              <div className="flex gap-2">
                <WizardBack onClick={() => setStep(0)} />
                <WizardNext
                  disabled={!/^\S+@\S+\.\S+$/.test(email) || password.length < 8}
                  onClick={() => setStep(2)}
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <label className="flex items-center justify-between text-sm text-gray-700">
                צבע המותג שלכם
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-16 h-10 rounded cursor-pointer border-0 bg-transparent" />
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={sampleMenu} onChange={(e) => setSampleMenu(e.target.checked)} />
                התחילו עם תפריט לדוגמה (אפשר לערוך הכל אחר כך)
              </label>
              <div className="rounded-xl p-3 text-xs text-gray-500 bg-gray-50">
                💡 לוגו, תמונות וכל שאר המיתוג — בדשבורד אחרי ההקמה. ייבוא תפריט מ-Wolt זמין שם גם כן.
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <WizardBack onClick={() => setStep(1)} />
                <button
                  onClick={submit}
                  disabled={busy}
                  className="flex-1 py-3 rounded-xl font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ backgroundColor: PRIMARY }}
                >
                  {busy ? (<><Loader2 className="w-4 h-4 animate-spin" /> מקים את החנות...</>) : "🚀 פתחו לי חנות"}
                </button>
              </div>
            </>
          )}

          {step === 3 && done && (
            <div className="text-center space-y-4 py-4">
              <div className="text-5xl">🎉</div>
              <h2 className="text-xl font-bold text-gray-900">החנות שלכם באוויר!</h2>
              <a
                href={storeUrl(done.slug)}
                className="block w-full py-3 rounded-xl font-bold text-white"
                style={{ backgroundColor: PRIMARY }}
              >
                לצפייה בחנות ←
              </a>
              <a
                href={`${storeUrl(done.slug)}/dashboard`}
                className="block w-full py-3 rounded-xl font-bold border-2"
                style={{ borderColor: PRIMARY, color: PRIMARY }}
              >
                לדשבורד הניהול ←
              </a>
              <p className="text-xs text-gray-500">
                נכנסים לדשבורד עם האימייל והסיסמה שהגדרתם · משם: תפריט, מיתוג, אזורי משלוח ודומיין משלכם
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WizardNext({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex-1 w-full py-3 rounded-xl font-bold text-white disabled:opacity-40"
      style={{ backgroundColor: PRIMARY }}
    >
      המשך
    </button>
  );
}
function WizardBack({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="px-5 py-3 rounded-xl font-bold border border-gray-200 text-gray-600">
      חזרה
    </button>
  );
}
