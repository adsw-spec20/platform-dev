import { NextRequest, NextResponse } from "next/server";
import { parseHost } from "@/lib/tenant/parse-host";
import { resolveTenant } from "@/lib/tenant/resolve";

export async function middleware(req: NextRequest) {
  const host = req.headers.get("host");

  // Vercel preview/default domains serve platform pages until a real
  // root domain is chosen (brand name pending).
  if (host && host.toLowerCase().split(":")[0].endsWith(".vercel.app")) {
    return NextResponse.next();
  }

  const parsed = parseHost(
    host,
    process.env.PLATFORM_ROOT_DOMAIN ?? "localtest.me"
  );

  // Root domain = platform pages (marketing/wizard later). Pass through,
  // but block direct access to internal /store routes.
  if (parsed.kind === "root") {
    if (req.nextUrl.pathname.startsWith("/store")) {
      return new NextResponse("Not found", { status: 404 });
    }
    return NextResponse.next();
  }

  if (parsed.kind === "invalid") {
    return new NextResponse("Not found", { status: 404 });
  }

  const tenant = await resolveTenant(parsed);
  if (!tenant) {
    return new NextResponse("Store not found", { status: 404 });
  }

  const headers = new Headers(req.headers);
  headers.set("x-tenant-id", tenant.id);
  headers.set("x-tenant-slug", tenant.slug);
  headers.set("x-tenant-status", tenant.status);

  // API routes keep their paths (with tenant headers attached).
  if (req.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.next({ request: { headers } });
  }

  // Tenant host: serve the storefront route tree.
  const url = req.nextUrl.clone();
  url.pathname = `/store${url.pathname === "/" ? "" : url.pathname}`;
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
