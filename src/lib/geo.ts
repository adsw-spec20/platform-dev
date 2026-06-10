/** Geometry helpers for polygon delivery zones. Points are [lat, lng]. */

export type Zone = {
  id: string;
  name: string;
  price: number; // agorot
  polygon: [number, number][];
  is_active: boolean;
  sort_order: number;
};

/** Ray-casting point-in-polygon. */
export function pointInPolygon(
  point: [number, number],
  polygon: [number, number][]
): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** First active zone (by sort_order) containing the point, or null. */
export function resolveZone(
  point: [number, number],
  zones: Zone[]
): Zone | null {
  const sorted = [...zones]
    .filter((z) => z.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);
  for (const z of sorted) {
    if (pointInPolygon(point, z.polygon)) return z;
  }
  return null;
}
