"use client";

import { useCallback, useEffect, useState } from "react";
import { MapContainer, TileLayer, Polygon, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Trash2, Eye, EyeOff, Undo2, Check, X } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useTenantId } from "@/lib/dashboard/use-tenant-id";
import { formatPrice } from "@/lib/format";

type Zone = {
  id: string;
  name: string;
  price: number;
  polygon: [number, number][];
  is_active: boolean;
  sort_order: number;
};

const ZONE_COLORS = ["#DC2626", "#2563EB", "#16A34A", "#F59E0B", "#9333EA", "#0891B2"];

export function ZonesEditor() {
  const tenantId = useTenantId();
  const [zones, setZones] = useState<Zone[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabaseBrowser()
      .from("delivery_zones")
      .select("*")
      .order("sort_order");
    setZones((data as Zone[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function finishDraft() {
    if (draft.length < 3) return setError("אזור צריך לפחות 3 נקודות");
    const name = prompt("שם האזור (למשל: מרכז העיר):");
    if (!name?.trim()) return;
    const priceStr = prompt("דמי משלוח לאזור (₪):", "15");
    const price = Math.round((parseFloat(priceStr ?? "0") || 0) * 100);
    const { error } = await supabaseBrowser().from("delivery_zones").insert({
      tenant_id: tenantId,
      name: name.trim(),
      price,
      polygon: draft,
      sort_order: zones.length,
    });
    if (error) setError(error.message);
    setDraft([]);
    setDrawing(false);
    load();
  }

  async function toggleZone(z: Zone) {
    await supabaseBrowser()
      .from("delivery_zones")
      .update({ is_active: !z.is_active })
      .eq("id", z.id);
    load();
  }

  async function deleteZone(z: Zone) {
    if (!confirm(`למחוק את אזור "${z.name}"?`)) return;
    await supabaseBrowser().from("delivery_zones").delete().eq("id", z.id);
    load();
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-color)" }}>
          אזורי משלוח
        </h1>
        {!drawing ? (
          <button
            onClick={() => {
              setDrawing(true);
              setDraft([]);
              setError(null);
            }}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            + צייר אזור חדש
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--brand-text-secondary)" }}>
              לחץ על המפה להוספת נקודות ({draft.length})
            </span>
            <button onClick={() => setDraft((p) => p.slice(0, -1))} disabled={draft.length === 0} aria-label="בטל נקודה" className="w-9 h-9 rounded-lg flex items-center justify-center disabled:opacity-40" style={{ border: "1px solid var(--brand-border)", color: "var(--text-color)" }}>
              <Undo2 className="w-4 h-4" />
            </button>
            <button onClick={finishDraft} disabled={draft.length < 3} aria-label="סיים אזור" className="w-9 h-9 rounded-lg flex items-center justify-center text-white disabled:opacity-40" style={{ backgroundColor: "#16A34A" }}>
              <Check className="w-4 h-4" />
            </button>
            <button onClick={() => { setDrawing(false); setDraft([]); }} aria-label="ביטול" className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ border: "1px solid var(--brand-border)", color: "#DC2626" }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm rounded-xl p-3" style={{ color: "#DC2626", backgroundColor: "#FEF2F2" }}>
          {error}
        </p>
      )}

      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--brand-border)" }}>
        <MapContainer
          center={[31.93, 34.866]}
          zoom={13}
          style={{ height: 420, width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {zones.map((z, i) => (
            <Polygon
              key={z.id}
              positions={z.polygon}
              pathOptions={{
                color: ZONE_COLORS[i % ZONE_COLORS.length],
                fillOpacity: z.is_active ? 0.18 : 0.05,
                opacity: z.is_active ? 0.9 : 0.35,
              }}
            />
          ))}
          {draft.length > 0 && (
            <Polygon positions={draft} pathOptions={{ color: "#111827", dashArray: "6", fillOpacity: 0.1 }} />
          )}
          {drawing && <DraftClicks onAdd={(p) => setDraft((prev) => [...prev, p])} />}
        </MapContainer>
      </div>

      <div className="space-y-2">
        {zones.length === 0 && (
          <p className="text-sm" style={{ color: "var(--brand-text-secondary)" }}>
            אין אזורים מוגדרים — המערכת משתמשת בדמי המשלוח הקבועים מההגדרות. צייר אזור ראשון כדי לתמחר לפי שכונות.
          </p>
        )}
        {zones.map((z, i) => (
          <div
            key={z.id}
            className="flex items-center gap-3 p-3 rounded-xl"
            style={{ backgroundColor: "var(--brand-bg-card)", border: "1px solid var(--brand-border)", opacity: z.is_active ? 1 : 0.55 }}
          >
            <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: ZONE_COLORS[i % ZONE_COLORS.length] }} />
            <span className="flex-1 text-sm font-medium" style={{ color: "var(--text-color)" }}>{z.name}</span>
            <span className="text-sm font-bold" style={{ color: "var(--brand-primary)" }}>{formatPrice(z.price)}</span>
            <button onClick={() => toggleZone(z)} aria-label={z.is_active ? "השבת" : "הפעל"} className="opacity-60 hover:opacity-100" style={{ color: "var(--text-color)" }}>
              {z.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <button onClick={() => deleteZone(z)} aria-label="מחיקה" style={{ color: "#DC2626" }}>
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function DraftClicks({ onAdd }: { onAdd: (p: [number, number]) => void }) {
  useMapEvents({
    click(e) {
      onAdd([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}
