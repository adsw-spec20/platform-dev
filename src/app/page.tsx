import Link from "next/link";

/** Platform landing (working brand TBD). */
export default function PlatformLanding() {
  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gray-50 flex flex-col"
      style={{ fontFamily: "'Rubik', sans-serif" }}
    >
      <header className="px-6 py-4 flex items-center justify-between max-w-5xl mx-auto w-full">
        <span className="font-bold text-lg text-gray-900">הפלטפורמה 🍔</span>
        <Link
          href="/signup"
          className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-red-600"
        >
          פתחו חנות
        </Link>
      </header>

      <main className="flex-1 flex items-center">
        <div className="max-w-5xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-10 items-center">
          <div className="space-y-5">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
              חנות הזמנות אונליין
              <br />
              <span className="text-red-600">לעסק האוכל שלך</span>
            </h1>
            <p className="text-gray-500 text-lg">
              תפריט חכם עם תוספות וחצי-חצי, הזמנות בזמן אמת למטבח, אזורי משלוח
              על מפה, מועדון לקוחות, קופונים וחיבור למדפסת — בלי עמלות מטורפות,
              עם הדומיין שלכם.
            </p>
            <ul className="space-y-1.5 text-sm text-gray-600">
              <li>✅ באוויר תוך דקות — תפריט, מיתוג ומשלוחים בניהול עצמי</li>
              <li>✅ הלקוחות שלכם נשארים שלכם</li>
              <li>✅ Webhooks למדפסת, לקופה ולכל אוטומציה</li>
            </ul>
            <div className="flex gap-3 pt-2">
              <Link
                href="/signup"
                className="px-6 py-3.5 rounded-2xl font-bold text-white bg-red-600 shadow-lg shadow-red-200"
              >
                🚀 פתחו חנות עכשיו
              </Link>
            </div>
          </div>

          <div className="hidden md:block">
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-5 space-y-3 rotate-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-red-600">הפיצרייה שלי</span>
                <span className="w-7 h-7 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">3</span>
              </div>
              <div className="flex gap-2">
                <span className="px-3 py-1.5 rounded-full text-xs font-bold text-white bg-red-600">🍕 פיצות</span>
                <span className="px-3 py-1.5 rounded-full text-xs border border-gray-200 text-gray-600">🥤 שתייה</span>
              </div>
              {[
                ["מרגריטה משפחתית", "₪58.00", "הכי נמכר!"],
                ["פיצה ביאנקה", "₪64.00", null],
              ].map(([name, price, badge]) => (
                <div key={name as string} className="flex gap-3 p-3 rounded-xl border border-gray-100">
                  <div className="w-14 h-14 rounded-lg bg-orange-50 flex items-center justify-center text-2xl">🍕</div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-gray-800">{name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-bold text-red-600 text-sm">{price}</span>
                      {badge && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] text-white bg-amber-500">{badge}</span>
                      )}
                    </div>
                  </div>
                  <span className="self-center w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center">+</span>
                </div>
              ))}
              <div className="rounded-xl py-3 text-center text-sm font-bold text-white bg-red-600">
                מעבר לתשלום · ₪122.00
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-gray-400">
        הפלטפורמה · מערכת הזמנות לעסקי מזון
      </footer>
    </div>
  );
}
