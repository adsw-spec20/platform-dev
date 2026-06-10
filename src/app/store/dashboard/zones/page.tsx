"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window` - client-only.
const ZonesEditor = dynamic(
  () => import("@/components/dashboard/ZonesEditor").then((m) => m.ZonesEditor),
  { ssr: false, loading: () => <div className="p-6"><div className="h-80 rounded-xl animate-pulse bg-black/5" /></div> }
);

export default function ZonesPage() {
  return <ZonesEditor />;
}
