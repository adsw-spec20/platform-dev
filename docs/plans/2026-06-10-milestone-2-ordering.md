# Milestone 2 — Cart, Checkout (cash), Orders, Live Dashboard Board

**Goal:** A customer browses a tenant's store, builds a cart (full options UX incl. "n free then pay"), checks out as guest with cash, and the order appears LIVE on the tenant's dashboard where staff advance it through the status flow; customer sees live tracking.

**Key decisions:**
- **Cash only** in M2 (Hypay/Grow adapter = M4). Payment field designed for extension.
- **Guest checkout without OTP** in M2 — name+phone entered manually. OTP slots into the same step when an SMS provider is chosen (waiting-on-Adir). The checkout step structure matches the final design so OTP is an insert, not a rework.
- **Flat delivery fee** from new `tenant_settings` (polygon zones = M3 delivery editor).
- **Server-side pricing:** the API recomputes every line from DB prices — client totals are never trusted.
- **Status state machine** enforced server-side; invalid transition = 409 (QuickFood lesson).
- **Realtime:** Supabase Realtime on `orders` for dashboard + tracking page.

## Tasks

1. **Migration 0004**: `tenant_settings` (tenant_id PK, delivery_enabled, pickup_enabled, delivery_fee int agorot, min_order int agorot, prep_minutes int default 30), `order_counters` (tenant_id PK, last_number int), `orders` (id uuid, tenant_id, number int, status text CHECK in (new, preparing, ready, out_for_delivery, completed, canceled), method delivery|pickup, payment_method cash, payment_status pending|paid|na, customer_name, customer_phone, address jsonb, customer_notes, items jsonb, subtotal int, delivery_fee int, total int, scheduled_time timestamptz null, created_at, updated_at). RLS: staff full on own tenant; anon nothing. `alter publication supabase_realtime add table orders`. Seed: settings rows for both demo tenants.
2. **Pricing lib (TDD)** `src/lib/pricing.ts`: `calcLinePrice(item, selections, qty)` — single/multi/quantity groups, price_delta per unit, **free_quantity rule: cheapest selections free first? NO — HB rule: first N selected are free in selection order? Spec: "עד N בחירות ללא תוספת תשלום"; implement: sort selected paid-eligible options descending? Use HB behavior: free applies to the first N units counted in selection order; simplest deterministic: free covers the N cheapest? — DECISION: free covers the N most expensive selections (customer-favorable, matches "2 חינם" badge math in HB cart). Tests pin the rule.** `calcCartTotals(lines, settings, method)`.
3. **Cart context** `src/components/store/CartProvider.tsx`: per-tenant localStorage (`cart:{slug}`), add/edit/remove/qty, drawer (mobile bottom sheet, desktop sidebar per spec §5).
4. **Item options sheet** per spec §4: group rendering (radio rows / checkbox rows with max enforcement / quantity steppers), free-quantity badges, notes textarea, live price, validation messages, add-to-cart. Wire ItemCard click + quick-add FAB.
5. **Order API** `POST /api/orders`: zod-validated body, server pricing, settings checks (min order, method enabled), per-tenant order number (atomic counter update), insert. `PATCH /api/orders/[id]/status` (staff JWT required): state-machine validation, 409 on invalid.
6. **Checkout UI** `/store/checkout`: cart review → details (method toggle, address fields when delivery, name+phone, notes) → place order → redirect to tracking.
7. **Tracking page** `/store/track/[id]`: stepper per spec §7 (delivery/pickup variants), Realtime subscription, totals + items summary.
8. **Staff login + dashboard board** `/dashboard`: email+password (supabase-js auth), guard by staff_members membership; live orders board — new orders appear via Realtime with sound, status advance buttons (state machine), today's orders list.
9. **Tests**: pricing rules (incl. free-quantity edge cases), state-machine API tests (valid/invalid transitions), isolation extension: staff A cannot read/update orders of tenant B (CRITICAL — extends iron-rule suite).
10. **Verify E2E locally** (curl + dev server: create order → appears for staff A not staff B → advance statuses → tracking reflects), full suite, deploy.

## Acceptance
Order placed on demo-a (cash, delivery) → number ORD-1 style per-tenant → dashboard (owner-a) shows it live, advances new→preparing→ready→out_for_delivery→completed → tracking page mirrors live; owner-b sees nothing; invalid transition 409; all tests green.
