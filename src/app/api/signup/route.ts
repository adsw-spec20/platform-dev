import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { provisionTenant, isSlugAvailable } from "@/lib/server/provision";

const Schema = z.object({
  business_name: z.string().min(2).max(80),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,48}$/),
  email: z.string().email().max(200),
  password: z.string().min(8).max(100),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  seed_sample_menu: z.boolean().optional(),
  website: z.string().max(0).optional(), // honeypot - must stay empty
});

/** Self-service signup. Root domain only (tenant hosts don't reach this). */
export async function POST(req: Request) {
  const h = await headers();
  if (h.get("x-tenant-id")) {
    return NextResponse.json({ error: { code: "not_here" } }, { status: 404 });
  }
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", details: parsed.error.flatten() } },
      { status: 422 }
    );
  }
  if (parsed.data.website) {
    // Honeypot tripped - pretend success, create nothing.
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const result = await provisionTenant({
    businessName: parsed.data.business_name,
    slug: parsed.data.slug,
    ownerEmail: parsed.data.email,
    ownerPassword: parsed.data.password,
    primaryColor: parsed.data.primary_color,
    seedSampleMenu: parsed.data.seed_sample_menu ?? true,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: { code: result.code, message: result.message } },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true, slug: result.slug }, { status: 201 });
}

export async function GET(req: Request) {
  // Slug availability check for the wizard.
  const { searchParams } = new URL(req.url);
  const slug = (searchParams.get("slug") ?? "").trim().toLowerCase();
  const available = await isSlugAvailable(slug);
  return NextResponse.json({ slug, available });
}
