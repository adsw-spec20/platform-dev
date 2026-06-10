"use client";

import { useEffect, useState } from "react";
import { X, Plus, Trash2, Upload } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export type EditorItem = { id: string };

type GroupDraft = {
  id?: string;
  name: string;
  type: "single" | "multi" | "quantity";
  required: boolean;
  min_select: number;
  max_select: number | null;
  free_quantity: number;
  options: {
    id?: string;
    name: string;
    price_shekels: string; // editable as shekels text
    is_default: boolean;
  }[];
};

const EMPTY_GROUP: GroupDraft = {
  name: "",
  type: "multi",
  required: false,
  min_select: 0,
  max_select: null,
  free_quantity: 0,
  options: [],
};

export function ItemEditorDialog({
  tenantId,
  categoryId,
  itemId,
  onClose,
}: {
  tenantId: string;
  categoryId: string;
  itemId: string | null;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceShekels, setPriceShekels] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [badgeLabel, setBadgeLabel] = useState("");
  const [badgeColor, setBadgeColor] = useState<string>("accent");
  const [groups, setGroups] = useState<GroupDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      if (!itemId) {
        setLoaded(true);
        return;
      }
      const db = supabaseBrowser();
      const [{ data: item }, { data: gs }, { data: os }] = await Promise.all([
        db.from("menu_items").select("*").eq("id", itemId).single(),
        db.from("option_groups").select("*").eq("item_id", itemId).order("sort_order"),
        db.from("options").select("*").order("sort_order"),
      ]);
      if (item) {
        setName(item.name);
        setDescription(item.description ?? "");
        setPriceShekels((item.price / 100).toFixed(2));
        setImageUrl(item.image_url);
        setBadgeLabel(item.badge_label ?? "");
        setBadgeColor(item.badge_color ?? "accent");
      }
      setGroups(
        (gs ?? [])
          .filter((g) => g.type !== "text")
          .map((g) => ({
            id: g.id,
            name: g.name,
            type: g.type,
            required: g.required,
            min_select: g.min_select,
            max_select: g.max_select,
            free_quantity: g.free_quantity,
            options: (os ?? [])
              .filter((o) => o.group_id === g.id)
              .map((o) => ({
                id: o.id,
                name: o.name,
                price_shekels: (o.price_delta / 100).toFixed(2),
                is_default: o.is_default,
              })),
          }))
      );
      setLoaded(true);
    }
    load();
  }, [itemId]);

  async function uploadImage(file: File) {
    setUploading(true);
    setError(null);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${tenantId}/items/${crypto.randomUUID()}.${ext}`;
    const db = supabaseBrowser();
    const { error } = await db.storage.from("public-assets").upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) {
      setError(`העלאת תמונה נכשלה: ${error.message}`);
    } else {
      const { data } = db.storage.from("public-assets").getPublicUrl(path);
      setImageUrl(data.publicUrl);
    }
    setUploading(false);
  }

  async function save() {
    setError(null);
    const price = Math.round(parseFloat(priceShekels) * 100);
    if (!name.trim()) return setError("נדרש שם מנה");
    if (!Number.isFinite(price) || price < 0) return setError("מחיר לא תקין");
    for (const g of groups) {
      if (!g.name.trim()) return setError("לכל קבוצת אפשרויות נדרש שם");
      if (g.options.some((o) => !o.name.trim()))
        return setError(`אפשרות ללא שם בקבוצה "${g.name}"`);
    }

    setBusy(true);
    const db = supabaseBrowser();
    const itemPayload = {
      tenant_id: tenantId,
      category_id: categoryId,
      name: name.trim(),
      description: description.trim() || null,
      price,
      image_url: imageUrl,
      badge_label: badgeLabel.trim() || null,
      badge_color: badgeLabel.trim() ? badgeColor : null,
    };

    let id = itemId;
    if (id) {
      const { error } = await db.from("menu_items").update(itemPayload).eq("id", id);
      if (error) { setError(error.message); setBusy(false); return; }
    } else {
      const { data, error } = await db
        .from("menu_items").insert(itemPayload).select("id").single();
      if (error || !data) { setError(error?.message ?? "שמירה נכשלה"); setBusy(false); return; }
      id = data.id;
    }

    // Replace option groups wholesale (simple + correct; ids regenerate).
    await db.from("option_groups").delete().eq("item_id", id);
    for (const [gi, g] of groups.entries()) {
      const { data: group, error: ge } = await db
        .from("option_groups")
        .insert({
          tenant_id: tenantId,
          item_id: id,
          name: g.name.trim(),
          type: g.type,
          required: g.required,
          min_select: g.required ? Math.max(1, g.min_select) : g.min_select,
          max_select: g.max_select,
          free_quantity: g.free_quantity,
          sort_order: gi,
        })
        .select("id").single();
      if (ge || !group) { setError(ge?.message ?? "שמירת קבוצה נכשלה"); setBusy(false); return; }
      if (g.options.length > 0) {
        const { error: oe } = await db.from("options").insert(
          g.options.map((o, oi) => ({
            tenant_id: tenantId,
            group_id: group.id,
            name: o.name.trim(),
            price_delta: Math.round((parseFloat(o.price_shekels) || 0) * 100),
            is_default: o.is_default,
            sort_order: oi,
          }))
        );
        if (oe) { setError(oe.message); setBusy(false); return; }
      }
    }
    onClose();
  }

  const inputStyle: React.CSSProperties = {
    borderRadius: 10,
    border: "1px solid var(--brand-border)",
    backgroundColor: "var(--brand-bg-card)",
    color: "var(--text-color)",
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl p-5 space-y-4"
        style={{ backgroundColor: "var(--brand-bg-card)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: "var(--text-color)" }}>
            {itemId ? "עריכת מנה" : "מנה חדשה"}
          </h2>
          <button onClick={onClose} aria-label="סגירה" className="w-8 h-8 rounded-full flex items-center justify-center" style={{ border: "1px solid var(--brand-border)" }}>
            <X className="w-4 h-4" style={{ color: "var(--text-color)" }} />
          </button>
        </div>

        {!loaded ? (
          <div className="h-40 animate-pulse rounded-xl bg-black/5" />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-4">
              <div className="space-y-3">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="שם המנה" className="w-full p-2.5 text-sm outline-none" style={inputStyle} />
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="תיאור" rows={2} className="w-full p-2.5 text-sm outline-none resize-none" style={inputStyle} />
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <input value={priceShekels} onChange={(e) => setPriceShekels(e.target.value)} placeholder="מחיר" inputMode="decimal" dir="ltr" className="w-full p-2.5 text-sm outline-none" style={inputStyle} />
                    <span className="absolute top-1/2 -translate-y-1/2 start-2 text-xs" style={{ color: "var(--brand-text-secondary)" }}>₪</span>
                  </div>
                  <input value={badgeLabel} onChange={(e) => setBadgeLabel(e.target.value)} placeholder='תגית (למשל "הכי נמכר!")' className="flex-1 p-2.5 text-sm outline-none" style={inputStyle} />
                </div>
              </div>
              <div>
                <label
                  className="w-full aspect-square rounded-xl overflow-hidden flex flex-col items-center justify-center gap-1 cursor-pointer text-xs"
                  style={{ border: "1px dashed var(--brand-border)", color: "var(--brand-text-secondary)" }}
                >
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : uploading ? (
                    "מעלה..."
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      העלאת תמונה
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadImage(f);
                    }}
                  />
                </label>
                {imageUrl && (
                  <button onClick={() => setImageUrl(null)} className="w-full mt-1 text-xs underline" style={{ color: "var(--brand-text-secondary)" }}>
                    הסר תמונה
                  </button>
                )}
              </div>
            </div>

            {/* Option groups */}
            <div className="space-y-3">
              <h3 className="font-bold text-sm" style={{ color: "var(--text-color)" }}>
                קבוצות אפשרויות
              </h3>
              {groups.map((g, gi) => (
                <div key={gi} className="rounded-xl p-3 space-y-2" style={{ border: "1px solid var(--brand-border)" }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={g.name}
                      onChange={(e) => updateGroup(gi, { name: e.target.value })}
                      placeholder="שם הקבוצה (למשל: תוספות)"
                      className="flex-1 min-w-40 p-2 text-sm outline-none"
                      style={inputStyle}
                    />
                    <select
                      value={g.type}
                      onChange={(e) => updateGroup(gi, { type: e.target.value as GroupDraft["type"] })}
                      className="p-2 text-sm outline-none"
                      style={inputStyle}
                    >
                      <option value="single">בחירה אחת</option>
                      <option value="multi">בחירה מרובה</option>
                      <option value="quantity">כמות לכל אפשרות</option>
                    </select>
                    <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-color)" }}>
                      <input type="checkbox" checked={g.required} onChange={(e) => updateGroup(gi, { required: e.target.checked })} />
                      חובה
                    </label>
                    <button onClick={() => setGroups((p) => p.filter((_, i) => i !== gi))} aria-label="מחק קבוצה" className="ms-auto" style={{ color: "#DC2626" }}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs items-center" style={{ color: "var(--brand-text-secondary)" }}>
                    <label className="flex items-center gap-1">
                      מקס׳ בחירות:
                      <input
                        type="number" min={0}
                        value={g.max_select ?? ""}
                        onChange={(e) => updateGroup(gi, { max_select: e.target.value === "" ? null : Math.max(0, parseInt(e.target.value)) })}
                        className="w-16 p-1.5 outline-none" style={inputStyle} placeholder="∞"
                      />
                    </label>
                    <label className="flex items-center gap-1">
                      חינם (n ראשונות):
                      <input
                        type="number" min={0}
                        value={g.free_quantity}
                        onChange={(e) => updateGroup(gi, { free_quantity: Math.max(0, parseInt(e.target.value) || 0) })}
                        className="w-16 p-1.5 outline-none" style={inputStyle}
                      />
                    </label>
                  </div>

                  {g.options.map((o, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input
                        value={o.name}
                        onChange={(e) => updateOption(gi, oi, { name: e.target.value })}
                        placeholder="שם האפשרות"
                        className="flex-1 p-2 text-sm outline-none"
                        style={inputStyle}
                      />
                      <div className="relative w-24">
                        <input
                          value={o.price_shekels}
                          onChange={(e) => updateOption(gi, oi, { price_shekels: e.target.value })}
                          placeholder="0" inputMode="decimal" dir="ltr"
                          className="w-full p-2 text-sm outline-none"
                          style={inputStyle}
                        />
                        <span className="absolute top-1/2 -translate-y-1/2 start-1.5 text-xs" style={{ color: "var(--brand-text-secondary)" }}>+₪</span>
                      </div>
                      <button onClick={() => setGroups((p) => p.map((gg, i) => i === gi ? { ...gg, options: gg.options.filter((_, j) => j !== oi) } : gg))} aria-label="מחק אפשרות" style={{ color: "#DC2626" }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setGroups((p) => p.map((gg, i) => i === gi ? { ...gg, options: [...gg.options, { name: "", price_shekels: "0", is_default: false }] } : gg))}
                    className="flex items-center gap-1 text-xs font-medium"
                    style={{ color: "var(--brand-primary)" }}
                  >
                    <Plus className="w-3.5 h-3.5" /> הוסף אפשרות
                  </button>
                </div>
              ))}
              <button
                onClick={() => setGroups((p) => [...p, { ...EMPTY_GROUP, options: [] }])}
                className="flex items-center gap-1.5 text-sm font-medium"
                style={{ color: "var(--brand-primary)" }}
              >
                <Plus className="w-4 h-4" /> קבוצת אפשרויות חדשה
              </button>
            </div>

            {error && (
              <p className="text-sm rounded-xl p-3" style={{ color: "#DC2626", backgroundColor: "#FEF2F2" }}>
                {error}
              </p>
            )}
            <button
              onClick={save}
              disabled={busy || uploading}
              className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-60"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              {busy ? "שומר..." : "שמירה"}
            </button>
          </>
        )}
      </div>
    </div>
  );

  function updateGroup(gi: number, patch: Partial<GroupDraft>) {
    setGroups((p) => p.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  }
  function updateOption(
    gi: number,
    oi: number,
    patch: Partial<GroupDraft["options"][number]>
  ) {
    setGroups((p) =>
      p.map((g, i) =>
        i === gi
          ? { ...g, options: g.options.map((o, j) => (j === oi ? { ...o, ...patch } : o)) }
          : g
      )
    );
  }
}
