"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus, Pencil, Trash2, ChevronUp, ChevronDown, Eye, EyeOff,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useTenantId } from "@/lib/dashboard/use-tenant-id";
import { formatPrice } from "@/lib/format";
import { ItemEditorDialog, type EditorItem } from "@/components/dashboard/ItemEditorDialog";

type Category = {
  id: string;
  name: string;
  sort_order: number;
  is_available: boolean;
};
type ItemRow = {
  id: string;
  category_id: string;
  name: string;
  price: number;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
  badge_label: string | null;
};

export default function MenuEditorPage() {
  const tenantId = useTenantId();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditorItem | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const db = supabaseBrowser();
    const [{ data: cats }, { data: its }] = await Promise.all([
      db.from("menu_categories").select("id, name, sort_order, is_available").order("sort_order"),
      db.from("menu_items")
        .select("id, category_id, name, price, image_url, is_available, sort_order, badge_label")
        .order("sort_order"),
    ]);
    setCategories(cats ?? []);
    setItems((its as ItemRow[]) ?? []);
    setSelectedCat((prev) => prev ?? cats?.[0]?.id ?? null);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addCategory() {
    const name = prompt("שם הקטגוריה החדשה:");
    if (!name?.trim() || !tenantId) return;
    const { error } = await supabaseBrowser().from("menu_categories").insert({
      tenant_id: tenantId,
      name: name.trim(),
      sort_order: categories.length,
    });
    if (error) setError(error.message);
    load();
  }

  async function renameCategory(cat: Category) {
    const name = prompt("שם חדש:", cat.name);
    if (!name?.trim()) return;
    await supabaseBrowser().from("menu_categories").update({ name: name.trim() }).eq("id", cat.id);
    load();
  }

  async function toggleCategory(cat: Category) {
    await supabaseBrowser()
      .from("menu_categories")
      .update({ is_available: !cat.is_available })
      .eq("id", cat.id);
    load();
  }

  async function deleteCategory(cat: Category) {
    const count = items.filter((i) => i.category_id === cat.id).length;
    if (!confirm(`למחוק את "${cat.name}"${count ? ` יחד עם ${count} מנות` : ""}?`)) return;
    await supabaseBrowser().from("menu_categories").delete().eq("id", cat.id);
    if (selectedCat === cat.id) setSelectedCat(null);
    load();
  }

  async function moveCategory(cat: Category, dir: -1 | 1) {
    const idx = categories.findIndex((c) => c.id === cat.id);
    const other = categories[idx + dir];
    if (!other) return;
    const db = supabaseBrowser();
    await Promise.all([
      db.from("menu_categories").update({ sort_order: other.sort_order }).eq("id", cat.id),
      db.from("menu_categories").update({ sort_order: cat.sort_order }).eq("id", other.id),
    ]);
    load();
  }

  async function toggleItem(item: ItemRow) {
    await supabaseBrowser()
      .from("menu_items")
      .update({ is_available: !item.is_available })
      .eq("id", item.id);
    load();
  }

  async function deleteItem(item: ItemRow) {
    if (!confirm(`למחוק את "${item.name}"?`)) return;
    await supabaseBrowser().from("menu_items").delete().eq("id", item.id);
    load();
  }

  const catItems = items.filter((i) => i.category_id === selectedCat);

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <h1 className="text-2xl font-bold mb-5" style={{ color: "var(--text-color)" }}>
        עריכת תפריט
      </h1>
      {error && (
        <p className="mb-3 text-sm rounded-xl p-3" style={{ color: "#DC2626", backgroundColor: "#FEF2F2" }}>
          {error}
        </p>
      )}

      <div className="grid md:grid-cols-[260px_1fr] gap-5">
        {/* Categories panel */}
        <div
          className="rounded-xl p-3 space-y-1 self-start"
          style={{ backgroundColor: "var(--brand-bg-card)", border: "1px solid var(--brand-border)" }}
        >
          {categories.map((cat, idx) => (
            <div
              key={cat.id}
              className="group flex items-center gap-1 rounded-lg px-2 py-2 cursor-pointer"
              style={{
                backgroundColor:
                  selectedCat === cat.id
                    ? "color-mix(in srgb, var(--brand-primary) 10%, transparent)"
                    : "transparent",
              }}
              onClick={() => setSelectedCat(cat.id)}
            >
              <span
                className="flex-1 text-sm font-medium truncate"
                style={{
                  color: "var(--text-color)",
                  opacity: cat.is_available ? 1 : 0.45,
                }}
              >
                {cat.name}
              </span>
              <IconBtn label="הזז למעלה" onClick={(e) => { e.stopPropagation(); moveCategory(cat, -1); }} disabled={idx === 0}>
                <ChevronUp className="w-3.5 h-3.5" />
              </IconBtn>
              <IconBtn label="הזז למטה" onClick={(e) => { e.stopPropagation(); moveCategory(cat, 1); }} disabled={idx === categories.length - 1}>
                <ChevronDown className="w-3.5 h-3.5" />
              </IconBtn>
              <IconBtn label="שינוי שם" onClick={(e) => { e.stopPropagation(); renameCategory(cat); }}>
                <Pencil className="w-3.5 h-3.5" />
              </IconBtn>
              <IconBtn label={cat.is_available ? "השבת" : "הפעל"} onClick={(e) => { e.stopPropagation(); toggleCategory(cat); }}>
                {cat.is_available ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </IconBtn>
              <IconBtn label="מחיקה" danger onClick={(e) => { e.stopPropagation(); deleteCategory(cat); }}>
                <Trash2 className="w-3.5 h-3.5" />
              </IconBtn>
            </div>
          ))}
          <button
            onClick={addCategory}
            className="w-full flex items-center justify-center gap-1.5 py-2 mt-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            <Plus className="w-4 h-4" /> קטגוריה חדשה
          </button>
        </div>

        {/* Items panel */}
        <div className="space-y-2">
          {selectedCat == null ? (
            <p className="text-sm" style={{ color: "var(--brand-text-secondary)" }}>
              בחר קטגוריה
            </p>
          ) : (
            <>
              {catItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{
                    backgroundColor: "var(--brand-bg-card)",
                    border: "1px solid var(--brand-border)",
                    opacity: item.is_available ? 1 : 0.55,
                  }}
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span>🍽️</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" style={{ color: "var(--text-color)" }}>
                      {item.name}
                      {item.badge_label && (
                        <span className="ms-2 text-xs px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: "var(--brand-accent)" }}>
                          {item.badge_label}
                        </span>
                      )}
                    </p>
                    <p className="text-xs font-bold" style={{ color: "var(--brand-primary)" }}>
                      {formatPrice(item.price)}
                    </p>
                  </div>
                  <IconBtn label={item.is_available ? "סמן כאזל" : "החזר לזמינות"} onClick={() => toggleItem(item)}>
                    {item.is_available ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </IconBtn>
                  <IconBtn label="עריכה" onClick={() => setEditing(item as unknown as EditorItem)}>
                    <Pencil className="w-4 h-4" />
                  </IconBtn>
                  <IconBtn label="מחיקה" danger onClick={() => deleteItem(item)}>
                    <Trash2 className="w-4 h-4" />
                  </IconBtn>
                </div>
              ))}
              <button
                onClick={() => setEditing("new")}
                className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: "var(--brand-primary)" }}
              >
                <Plus className="w-4 h-4" /> מנה חדשה
              </button>
            </>
          )}
        </div>
      </div>

      {editing && selectedCat && tenantId && (
        <ItemEditorDialog
          tenantId={tenantId}
          categoryId={selectedCat}
          itemId={editing === "new" ? null : editing.id}
          onClose={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  label,
  danger,
  disabled,
}: {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  label: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className="w-7 h-7 rounded-md flex items-center justify-center hover:opacity-70 disabled:opacity-25 opacity-60"
      style={{ color: danger ? "#DC2626" : "var(--text-color)" }}
    >
      {children}
    </button>
  );
}
