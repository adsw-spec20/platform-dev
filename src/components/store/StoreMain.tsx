"use client";

import { usePathname } from "next/navigation";
import { CartSidebar } from "./CartSidebar";

/** Menu page gets the fixed desktop cart sidebar; other store pages don't. */
export function StoreMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMenu = pathname === "/";

  return (
    <>
      <main className={`flex-1 ${isMenu ? "lg:pl-[372px]" : ""}`}>
        {children}
      </main>
      {isMenu && <CartSidebar />}
    </>
  );
}
