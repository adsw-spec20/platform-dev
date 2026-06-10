import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getFullMenu } from "@/lib/dal/tenant-data";
import { MenuView } from "@/components/store/MenuView";

export default async function StorePage() {
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  if (!tenantId) notFound();

  const menu = await getFullMenu(tenantId);
  return <MenuView menu={menu} />;
}
