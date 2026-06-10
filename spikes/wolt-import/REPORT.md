# Wolt Import Feasibility Report

Date: 2026-06-10
Venues probed: wolt.com/en/isr/tel-aviv/restaurant/puzzle-burger, wolt.com/en/isr/hasharon/restaurant/burger-verse
Method: direct HTTP GET with browser-like headers (no auth, no cookies)

## Working endpoints

| Endpoint | Status | Payload |
|---|---|---|
| `consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/{slug}/assortment` | **200** | **Full menu**: 9 categories, 56 items, 25 option groups (~150-220KB JSON) |
| `consumer-api.wolt.com/order-xp/web/v1/venue/slug/{slug}/dynamic/` | **200** | Venue info: open status, order minimum, delivery configs, header/banners (~15KB) |
| `restaurant-api.wolt.com/v4/venues/slug/{slug}/menu` | 200 | Empty body — deprecated |
| `restaurant-api.wolt.com/v3/venues/slug/{slug}` | 410 Gone | Retired |

## Verdict table

| Requirement (spec §10.5)         | Verdict | Evidence (JSON path) |
| -------------------------------- | ------- | -------------------- |
| Categories (incl. subcategories) | **YES** | `assortment.categories[]` — `name`, `slug`, `images`, `item_ids`, `subcategories` |
| Items + descriptions             | **YES** | `assortment.items[]` — `name`, `description` |
| Item prices                      | **YES** | `items[].price` (integer, minor units — matches our agorot convention) |
| Item images                      | **YES** | `items[].images[].url` (CDN, full-res) + `blurhash` |
| Venue logo + cover image         | **LIKELY** | `dynamic.venue.header` / `banners`; full detail expected in `venue_raw` — verify during build |
| Opening hours                    | **LIKELY** | `dynamic.venue.time_slots_schedule` + `venue_raw` — verify during build |
| Address + phone                  | **LIKELY** | expected in `dynamic.venue_raw` — verify during build |
| Option groups                    | **YES** | `assortment.options[]` — `name`, `type` (`multi_choice`/...), `values[]`, `default_value`; items reference via `items[].options[]` |
| Option min/max selections        | **YES (mapping work)** | per-value `multi_choice_config.total_range.{min,max}`; group-level constraints via item-side option references — needs mapping pass |
| Option free-quantity rules       | **OPEN** | not observed in these 2 venues (flat-priced options); test against a venue known to use "first N free" before final mapping |
| Option prices                    | **YES** | `options[].values[].price` (integer minor units) |

**Bonus finds beyond spec:** `items[].available_times` (days + time ranges — maps directly to our availability windows), `items[].dietary_preferences` (maps to dietary tags), `items[].max_quantity_per_purchase`, `dynamic.order_minimum`.

## Blocking risks

1. **Unofficial API** — these are Wolt's own web-client endpoints, not a public API. They can change without notice. Mitigation: importer is one-shot per onboarding (not a live sync), so breakage = fix the mapper, not a production outage. Keep raw-response snapshots in tests.
2. **Rate limiting / blocking** — none observed at this probe volume. Import runs once per new customer (low volume). Use server-side fetch with browser-like headers.
3. **Encoding** — responses are UTF-8 with Hebrew; read with explicit UTF-8 (PowerShell default mangles it; Node `fetch` handles it correctly).
4. **TOS consideration** — importing a restaurant's own menu at the restaurant's request is the same model QuickFood uses publicly. Low risk; revisit at legal-docs milestone (M9).

## Recommended import architecture for Milestone 8

Server-side route: paste URL → extract slug → fetch `assortment` + `dynamic/` → map to our schema (`menu_categories`, `menu_items`, `option_groups`, `options`) → download images to our storage (don't hotlink Wolt CDN) → present preview → commit on confirm. Prices import 1:1 (both integer minor units). `available_times` → our availability windows; `dietary_preferences` → tags.

## Fallback assessment

Not needed at this time — direct endpoints work without auth. If Wolt later blocks server-side fetches: Playwright headless capture of the same XHRs is viable (the web client calls these exact endpoints), at the cost of a heavier dependency.

## Conclusion

**FEASIBLE — QuickFood-grade import is achievable.** The two LIKELY rows (logo/hours/address in `venue_raw`) and the free-quantity OPEN row are the only verification items left for Milestone 8, and none of them threatens the core import.
