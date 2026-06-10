import { createClient } from "@supabase/supabase-js";
import type { HostResolution } from "./parse-host";

export type ResolvedTenant = {
  id: string;
  slug: string;
  name: string;
  status: string;
};

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { tenant: ResolvedTenant | null; at: number }>();

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/** Looks up the tenant for a parsed host. Cached for 60s per key. */
export async function resolveTenant(
  res: HostResolution
): Promise<ResolvedTenant | null> {
  if (res.kind !== "subdomain" && res.kind !== "custom") return null;
  const key = res.kind === "subdomain" ? `s:${res.slug}` : `c:${res.domain}`;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.tenant;

  const db = adminClient();
  const query = db.from("tenants").select("id, slug, name, status");
  const { data } =
    res.kind === "subdomain"
      ? await query.eq("slug", res.slug).maybeSingle()
      : await query.eq("custom_domain", res.domain).maybeSingle();

  const tenant = (data as ResolvedTenant | null) ?? null;
  cache.set(key, { tenant, at: Date.now() });
  return tenant;
}
