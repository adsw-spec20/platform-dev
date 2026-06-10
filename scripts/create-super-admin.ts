/**
 * Creates (or updates) the platform super-admin user.
 * Usage: npx tsx scripts/create-super-admin.ts <email> [password]
 * Marks the user with app_metadata.is_super_admin=true (no tenant binding).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { randomBytes } from "crypto";
import { writeFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
if (!email) {
  console.error("Usage: npx tsx scripts/create-super-admin.ts <email> [password]");
  process.exit(1);
}
const password = process.argv[3] ?? `Adm!${randomBytes(9).toString("base64url")}`;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { is_super_admin: true },
  });
  if (created.data.user) {
    console.log(`super admin created: ${email}`);
  } else {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const user = list.users.find((u) => u.email === email);
    if (!user) throw new Error(created.error?.message ?? "create failed");
    await admin.auth.admin.updateUserById(user.id, {
      password,
      app_metadata: { ...user.app_metadata, is_super_admin: true },
    });
    console.log(`super admin updated: ${email}`);
  }
  writeFileSync(".admin-credentials.txt", `email: ${email}\npassword: ${password}\n`);
  console.log("credentials saved to .admin-credentials.txt (gitignored)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
