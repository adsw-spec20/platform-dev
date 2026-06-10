import "server-only";

/** Wolt menu import (spec §10.5 hard requirement, feasibility proven in
 *  spikes/wolt-import/REPORT.md). Fetches the public consumer-assortment
 *  endpoints and maps to our menu structures. Prices are already integer
 *  minor units (agorot) on Wolt's side. */

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "application/json",
  "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
};

export type WoltMappedOption = { name: string; price_delta: number };
export type WoltMappedGroup = {
  name: string;
  type: "single" | "multi";
  required: boolean;
  min_select: number;
  max_select: number | null;
  free_quantity: number;
  options: WoltMappedOption[];
};
export type WoltMappedItem = {
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  groups: WoltMappedGroup[];
};
export type WoltMappedMenu = {
  venue_slug: string;
  categories: { name: string; items: WoltMappedItem[] }[];
  warnings: string[];
};

export function extractWoltSlug(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith("wolt.com")) return null;
    const parts = u.pathname.replace(/\/+$/, "").split("/");
    const slug = parts[parts.length - 1];
    return /^[a-z0-9-]{2,100}$/.test(slug) ? slug : null;
  } catch {
    return null;
  }
}

type WoltAssortment = {
  categories: { id: string; name: string; item_ids: string[] }[];
  items: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    images?: { url: string }[];
    options?: {
      option_id: string;
      name: string;
      multi_choice_config?: {
        total_range?: { min: number; max: number };
        free_selections?: number;
      };
    }[];
  }[];
  options: {
    id: string;
    name: string;
    type: string;
    values: { id: string; name: string; price: number }[];
  }[];
};

export async function fetchWoltMenu(venueUrl: string): Promise<WoltMappedMenu | { error: string }> {
  const slug = extractWoltSlug(venueUrl);
  if (!slug) return { error: "כתובת Wolt לא תקינה — הדביקו קישור לעמוד המסעדה" };

  const res = await fetch(
    `https://consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/${slug}/assortment`,
    { headers: HEADERS, signal: AbortSignal.timeout(20_000) }
  ).catch(() => null);
  if (!res || !res.ok) {
    return { error: "לא הצלחנו למשוך את התפריט מ-Wolt — בדקו את הקישור ונסו שוב" };
  }
  const data = (await res.json()) as WoltAssortment;
  if (!data?.items?.length) return { error: "לא נמצא תפריט בעמוד הזה" };

  const warnings: string[] = [];
  const groupDefById = new Map(data.options?.map((o) => [o.id, o]) ?? []);
  const itemById = new Map(data.items.map((i) => [i.id, i]));

  const mapItem = (id: string): WoltMappedItem | null => {
    const it = itemById.get(id);
    if (!it) return null;
    const groups: WoltMappedGroup[] = [];
    for (const att of it.options ?? []) {
      const def = groupDefById.get(att.option_id);
      if (!def || !def.values?.length) continue;
      const range = att.multi_choice_config?.total_range;
      const min = range?.min ?? 0;
      const max = range?.max ?? null;
      const isSingle = def.type === "single_choice" || (min === 1 && max === 1);
      groups.push({
        name: att.name || def.name,
        type: isSingle ? "single" : "multi",
        required: min > 0,
        min_select: min,
        max_select: max && max > 0 ? max : null,
        free_quantity: att.multi_choice_config?.free_selections ?? 0,
        options: def.values.map((v) => ({
          name: v.name,
          price_delta: Math.max(0, Math.round(v.price ?? 0)),
        })),
      });
    }
    return {
      name: it.name,
      description: it.description || null,
      price: Math.max(0, Math.round(it.price ?? 0)),
      image_url: it.images?.[0]?.url ?? null,
      groups,
    };
  };

  let zeroPriceSkipped = 0;
  const categories = (data.categories ?? [])
    .map((c) => ({
      name: c.name,
      items: (c.item_ids ?? [])
        .map(mapItem)
        .filter((x): x is WoltMappedItem => {
          if (x === null) return false;
          // Zero-price entries on Wolt are informational notices, not dishes.
          if (x.price <= 0) {
            zeroPriceSkipped++;
            return false;
          }
          return true;
        }),
    }))
    .filter((c) => c.items.length > 0);
  if (zeroPriceSkipped > 0) {
    warnings.push(`${zeroPriceSkipped} פריטי מידע (₪0) דולגו`);
  }

  const mappedCount = categories.reduce((s, c) => s + c.items.length, 0);
  if (mappedCount < data.items.length) {
    warnings.push(`${data.items.length - mappedCount} פריטים לא שויכו לקטגוריה ולא יובאו`);
  }

  return { venue_slug: slug, categories, warnings };
}
