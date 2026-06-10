export type HostResolution =
  | { kind: "root" }
  | { kind: "subdomain"; slug: string }
  | { kind: "custom"; domain: string }
  | { kind: "invalid" };

/** Pure host-header parser. No I/O - DB lookup happens in resolve.ts. */
export function parseHost(
  rawHost: string | null,
  rootDomain: string
): HostResolution {
  if (!rawHost) return { kind: "invalid" };
  const host = rawHost.toLowerCase().split(":")[0];
  const root = rootDomain.toLowerCase();

  if (host === root || host === `www.${root}` || host === "localhost") {
    return { kind: "root" };
  }

  if (host.endsWith(`.${root}`)) {
    const prefix = host.slice(0, -(root.length + 1));
    if (prefix.includes(".")) return { kind: "invalid" };
    return { kind: "subdomain", slug: prefix };
  }

  const domain = host.startsWith("www.") ? host.slice(4) : host;
  if (!domain.includes(".")) return { kind: "invalid" };
  return { kind: "custom", domain };
}
