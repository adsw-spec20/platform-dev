import "server-only";
import { resolveZone, type Zone } from "@/lib/geo";
import { adminDb } from "./auth";

export type DeliveryQuote =
  | { ok: true; fee: number; zone_name: string | null }
  | { ok: false; reason: "outside_zones" | "geocode_failed" };

/** Geocode an Israeli address via Nominatim (OSM). ~1 req/s budget - fine at our scale. */
export async function geocodeAddress(
  street: string,
  houseNumber: string,
  city: string
): Promise<[number, number] | null> {
  const q = `${street} ${houseNumber}, ${city}, Israel`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "platform-dev/0.1 (restaurant ordering; dev)",
        "Accept-Language": "he",
      },
      // Nominatim results for a fixed address are stable - cache aggressively.
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { lat: string; lon: string }[];
    if (!data[0]) return null;
    return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch {
    return null;
  }
}

/**
 * Resolves the delivery fee for a tenant + address.
 * Active zones exist -> address must fall inside one (zone price wins).
 * No active zones -> flat fee from tenant_settings.
 */
export async function quoteDelivery(
  tenantId: string,
  address: { street: string; house_number: string; city: string },
  flatFee: number
): Promise<DeliveryQuote> {
  const { data: zones } = await adminDb()
    .from("delivery_zones")
    .select("id, name, price, polygon, is_active, sort_order")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (!zones || zones.length === 0) {
    return { ok: true, fee: flatFee, zone_name: null };
  }

  const point = await geocodeAddress(address.street, address.house_number, address.city);
  if (!point) return { ok: false, reason: "geocode_failed" };

  const zone = resolveZone(point, zones as Zone[]);
  if (!zone) return { ok: false, reason: "outside_zones" };
  return { ok: true, fee: zone.price, zone_name: zone.name };
}
