# Milestone 3 — Dashboard Editors

**Goal:** A business owner manages everything self-service: menu (categories, items, option groups, images), branding (live preview), business settings (hours, fees, operational status), staff & roles, and polygon delivery zones — no Claude/Adir intervention needed.

## Tasks
1. **Migration 0008**: `delivery_zones` (tenant_id, name, price agorot, polygon jsonb [[lat,lng]...], is_active, sort_order) + RLS; `tenant_settings` add `opening_hours jsonb`, `operational_status` (auto/busy/closed) + `busy_extra_minutes`; storage bucket `public-assets` with per-tenant folder RLS (authenticated write to `{tenant_id}/*`, public read).
2. **Dashboard chrome**: auth gate moves to `/store/dashboard/layout.tsx` (client) with sidebar nav (הזמנות/תפריט/מיתוג/משלוחים/הגדרות/צוות); store header/cart hidden on /dashboard paths.
3. **Menu editor**: category CRUD + reorder; item editor dialog (name, description, price ₪↔agorot, image upload to storage, badge, availability) + option-groups editor (type, required, min/max, free_quantity, options with price deltas). Direct supabase client writes under staff RLS.
4. **Branding editor**: colors (native pickers), font select, logo upload, live preview pane; saves themes row; storefront reflects on reload.
5. **Settings**: delivery/pickup toggles, delivery fee, min order, prep minutes, opening hours (7-day editor, "HH:MM-HH:MM" or closed), operational status (auto/busy/closed) → storefront banner + checkout guard.
6. **Staff & roles**: API routes with JWT verification (owner-only): create staff user (email+password+role), list, remove; role presets seeded per tenant (owner/manager/kitchen/delivery).
7. **Delivery zones**: Leaflet (OSM tiles, no API key) + polygon draw/edit; checkout geocodes address via Nominatim and resolves zone fee (point-in-polygon, TDD); fallback to flat fee when no active zones.
8. **Verification**: pricing/geo unit tests; staff API isolation tests; manual E2E checklist; build + deploy.

## Acceptance
Owner-a edits a price → storefront shows it; uploads item image; changes primary color → store recolors; sets Friday hours closed → checkout blocked Friday; draws zone with ₪20 fee → address inside zone priced ₪20, outside zone rejected (or flat fee if no zones); creates kitchen staff user that sees only the orders board.
