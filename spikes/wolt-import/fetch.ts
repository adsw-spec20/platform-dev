/**
 * SPIKE (throwaway): probe Wolt's public venue endpoints for menu data.
 * Usage: npx tsx spikes/wolt-import/fetch.ts https://wolt.com/he/isr/ramla/restaurant/<slug>
 * Writes raw JSON responses to spikes/wolt-import/out/ for analysis.
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const venueUrl = process.argv[2];
if (!venueUrl) {
  console.error("Usage: npx tsx spikes/wolt-import/fetch.ts <wolt venue URL>");
  process.exit(1);
}
const slug = venueUrl.replace(/\/+$/, "").split("/").pop()!;
console.log(`Venue slug: ${slug}`);

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "application/json",
  "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
};

const CANDIDATES = [
  `https://restaurant-api.wolt.com/v3/venues/slug/${slug}`,
  `https://restaurant-api.wolt.com/v4/venues/slug/${slug}/menu`,
  `https://restaurant-api.wolt.com/v4/venues/slug/${slug}/menu/data`,
  `https://consumer-api.wolt.com/order-xp/web/v1/venue/slug/${slug}/dynamic/`,
  `https://consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/${slug}/assortment`,
];

const outDir = join("spikes", "wolt-import", "out");
mkdirSync(outDir, { recursive: true });

for (const url of CANDIDATES) {
  try {
    const res = await fetch(url, { headers: HEADERS });
    const name = url.replace(/[^a-z0-9]+/gi, "_").slice(0, 80) + ".json";
    console.log(`${res.status}  ${url}`);
    if (res.ok) {
      const body = await res.text();
      writeFileSync(join(outDir, name), body);
      console.log(`   -> saved ${name} (${body.length} bytes)`);
    }
  } catch (e) {
    console.log(`ERR   ${url}: ${(e as Error).message}`);
  }
}
console.log("\nDone. Inspect spikes/wolt-import/out/*.json");
