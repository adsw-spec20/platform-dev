"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

/** Staff JWT carries app_metadata.tenant_id (the RLS key). */
export function useTenantId(): string | null {
  const [tenantId, setTenantId] = useState<string | null>(null);
  useEffect(() => {
    supabaseBrowser()
      .auth.getSession()
      .then(({ data }) => {
        const t = data.session?.user.app_metadata?.tenant_id;
        if (typeof t === "string") setTenantId(t);
      });
  }, []);
  return tenantId;
}
