# Home Burger Storefront — Design & UX Specification (Gold Standard)

> Extracted 2026-06-10 from the live HBv1.0 codebase (read-only). This is the design reference
> for the platform's storefront. The owner considers this design the product's gold standard:
> rebuild faithfully, parameterized per tenant via design tokens.

## 1. Global design system

**Token-based theming.** All branding lives in CSS custom properties, applied at the root:

```css
--primary-color: #DC2626;           /* Brand red */
--accent-color: #F59E0B;            /* Amber */
--text-color: #1F2937;
--background-color: #FEF2F2;        /* Warm off-white */
--brand-primary: /* dynamic */;
--brand-bg-card: #ffffff;
--brand-text-secondary: rgba(31, 41, 55, 0.6);
--brand-border: #e5e7eb;
--font-family: 'Rubik', sans-serif;
--radius: 0.5rem;
```

- Font: **Rubik** (Hebrew), weights 400/500/700. Admin-selectable alternatives: Heebo, Assistant, Secular One, Varela Round, Miriam Libre, Noto Sans Hebrew, IBM Plex Sans Hebrew, Frank Ruhl Libre.
- RTL: `<html lang="he" dir="rtl">`, native CSS RTL.
- Dark mode exists in HB (default ON, localStorage `hb_dark_mode`); platform: phase later, design tokens make it additive.
- Footer: own bg/text color tokens (HB defaults `#7C2D12` / `#FFFFFF`).

## 2. Menu page

- **Item grid:** `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`, gap-6 (gap-4 in search results).
- **Search bar:** placeholder "חיפוש מנות...", `border-radius: 24px`, `border: 1px solid var(--brand-border)`, `box-shadow: 0 2px 8px rgba(0,0,0,0.06)`, focus ring `0 0 0 3px color-mix(in srgb, var(--brand-primary) 15%, var(--brand-bg))`, `max-w-md`.
- **Sticky category nav:** horizontal scroll, hidden scrollbar, sticky below header (dynamic top via ResizeObserver), auto-hides on mobile scroll-down >80px. Container: `bg var(--brand-bg-card)`, `box-shadow 0 2px 8px rgba(0,0,0,0.05)`, `border-bottom 1px solid var(--brand-border)`, `px-4 py-3`.
- **Category buttons:** `px-4 py-2.5 rounded-full`, transition `all .2s ease`. Inactive: 1px brand-border, card bg, text-color, shadow `0 1px 3px rgba(0,0,0,0.04)`. Active: `bg var(--brand-primary)`, white text, `font-weight:700`, shadow `0 2px 8px color-mix(in srgb, var(--brand-primary) 30%, var(--brand-bg))`. Content: emoji + name. Click → smooth-scroll to section; scroll-spy updates active button.
- **Category section header:** `text-xl font-bold mb-6 py-3 px-4`, RTL accent border `border-left: 4px solid var(--brand-primary)` with `border-radius: 0 8px 8px 0`, card bg, shadow `0 1px 4px rgba(0,0,0,0.04)`.
- **Optional menu background image** with opacity (~0.06) + dark overlay (rgba(0,0,0,0.3)) — theme fields.

## 3. Menu item card ("Wolt style", horizontal)

```
<div class="flex gap-4 p-4" style="background: var(--brand-bg-card); border-radius: 12px;
     border: 1px solid var(--brand-border); box-shadow: 0 1px 4px rgba(0,0,0,0.04);
     min-height: 140px">
```

- Hover (desktop): `translateY(-2px)`, shadow `0 8px 24px rgba(0,0,0,0.1)`, `.2s ease`.
- Title: `font-semibold text-base sm:text-lg`, `var(--text-color)`.
- Description: `text-xs sm:text-sm mt-2`, `var(--brand-text-secondary)`, `line-clamp-2`.
- Price: `font-bold text-lg sm:text-xl`, `var(--brand-primary)`, format `₪{price.toFixed(2)}`.
- Optional badge: `px-2 py-1 rounded-full text-xs font-medium` (colors: primary/accent/success/warning/neutral).
- Image: side-positioned `w-24 h-24 md:w-28 md:h-28 rounded-xl overflow-hidden shadow-lg`, `group-hover:scale-105 transition .3s`, fallback emoji 🍽️.
- Unavailable overlay: `rgba(0,0,0,0.5) backdrop-blur-sm` + badge "לא זמין כעת" / "אזל".
- Quick-add FAB (no-options items): `w-10 h-10 rounded-full bg var(--brand-primary)`, white Plus icon, `absolute -bottom-1 -left-1`, hover scale-110.
- Entry animation: `initial {opacity:0, y:20} → animate {opacity:1, y:0}`, .3s.

## 4. Item options sheet (M2)

- Mobile: bottom sheet `rounded-t-2xl shadow-2xl` with drag handle `w-10 h-1.5 rounded-full`.
- Collapsible item image; close button `rounded-full bg-black/70 text-white`.
- Single choice: radio rows `px-3 py-3 rounded-xl`, radio `w-5 h-5 rounded-full border-2`, selected: brand-primary border + dot; selected row bg `color-mix(in srgb, var(--primary-color) 8%, transparent)`.
- Multi choice: checkbox `w-5 h-5 rounded border-2`, selected: brand-primary bg + white Check; disabled when max reached.
- Free-quantity UI: badges "חובה" (red), "נבחרו N מתוך N חינם" (green), "נותרו N חינם"; explainer "עד N בחירות ללא תוספת תשלום. כל בחירה נוספת בתוספת ₪X."
- Quantity selector: `w-9 h-9 rounded-lg` ± buttons brand-primary bg, active scale-90.
- Notes: Textarea "הערות או בקשות מיוחדות...", rounded-xl.
- Live total: bold, brand-primary, updates per selection.
- Validation messages: "חובה לבחור {groups}", "בחר לפחות N…", "ניתן לבחור עד M…".
- CTA: full-width rounded-xl py-3 bold brand-primary — "הוסף לעגלה" / "עדכן בעגלה".

## 5. Cart (M2)

- Desktop: fixed sidebar ~340px (`side="left"` in RTL), card bg. Mobile: bottom-sheet drawer (Framer Motion slide-up).
- Line item: flex gap-3 p-4 rounded-lg 1px brand-border; image 48-56px rounded-lg; name `font-semibold text-sm`; options summary `text-xs` secondary truncated; price bold brand-primary; inline [- qty +], edit (pencil), delete (trash).
- Totals: Subtotal / Delivery (or "בחר אופן משלוח") / Coupon -₪ / Loyalty -₪ / Total (border-top, bold, larger).
- Empty: 🛒 + "העגלה ריקה כרגע" + button "לתפריט".
- Checkout CTA: full-width `rounded-2xl py-4 font-bold text-lg` brand-primary, shadow `0 4px 12px rgba(0,0,0,0.15)`.

## 6. Checkout flow (M2/M4)

Steps: cart → guest_auth (phone+OTP; new users add first+last name) → details → payment.
- Delivery/Pickup toggle: two buttons, active brand-primary white.
- Address form (delivery): street, house number, apartment, floor, city + autocomplete; polygon zone validation returns fee; live "עלות משלוח: ₪X.XX".
- Scheduled time: "זמן מאוחר יותר" toggle → slots from opening hours, "היום, 20:30" format, 30-min intervals.
- Coupon: input + "החל קוד"; error "קוד קופון לא תקין"; success green ✓.
- Operational blocks: inline red banner, e.g. "ההזמנה לא אפשרית — המסעדה סגורה כעת."

## 7. Order tracking (M2)

Stepper: delivery = אושרה→בהכנה→בדרך אליך→הושלמה (CheckCircle/ChefHat/Truck/Home icons); pickup = אושרה→בהכנה→מוכנה→הושלמה (Package for ready). Circles `w-10 h-10 rounded-full` (active brand-primary/white, inactive brand-border), connecting lines `flex-1 h-1 mx-2`. Labels `mt-2 text-xs font-medium`.

## 8. Header / nav

- Sticky; auto-hides on mobile scroll-down. Logo start-side (h-8/h-10), nav links desktop-only, cart icon with badge (`w-6 h-6 rounded-full bg var(--brand-accent)` white count), user menu dropdown, mobile hamburger → slide-out menu (active link = brand-primary pill, white text, bold).
- Operational status banner above header when non-auto: `px-4 py-2.5` centered, emoji + text, solid saturated colors (red closed / orange paused).

## 9. Misc

- Empty/loading states: 9 pulse skeletons; error states differentiate offline ("אין חיבור לאינטרנט" 📡) vs server ("אופס! שגיאה בטעינת התפריט" 😔).
- Status notice modal: overlay `bg-black/60 backdrop-blur-sm z-[10000]`, card `rounded-2xl p-6 max-w-sm shadow-2xl`, emoji text-5xl.
- Animations: Framer Motion, durations 0.2-0.3s.
- Accessibility widget: font scaling 60-200%, contrast, TTS (later milestone).
- Floating links + popups system (phase 2).

## Breakpoints

sm 640 / md 768 / lg 1024 / xl 1280. Mobile: 1-col, auto-hiding header, drawer cart. Desktop: 2-3 col grid + fixed cart sidebar.
