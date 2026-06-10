"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus } from "lucide-react";
import type { MenuCategory, MenuItem } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { useCart } from "./CartProvider";

/** Storefront menu: search, sticky category nav with scroll-spy, Wolt-style cards.
 *  Design source: docs/design/storefront-spec.md (Home Burger gold standard). */
export function MenuView({ menu }: { menu: MenuCategory[] }) {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(
    menu[0]?.id ?? null
  );
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  const searching = query.trim().length > 0;

  const results = useMemo(() => {
    if (!searching) return [];
    const q = query.trim();
    return menu
      .flatMap((c) => c.items)
      .filter(
        (i) =>
          i.name.includes(q) || (i.description ?? "").includes(q)
      );
  }, [menu, query, searching]);

  // Scroll-spy: highlight the category whose section is in view.
  useEffect(() => {
    if (searching) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setActiveCat(e.target.getAttribute("data-cat-id"));
            break;
          }
        }
      },
      { rootMargin: "-120px 0px -70% 0px" }
    );
    sectionRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [menu, searching]);

  function scrollToCategory(id: string) {
    setActiveCat(id);
    sectionRefs.current
      .get(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (menu.length === 0) {
    return (
      <div className="text-center py-24 px-4">
        <div className="text-5xl mb-4">🍽️</div>
        <h2 className="text-xl font-bold">אין מנות זמינות כרגע</h2>
        <p className="text-sm mt-2" style={{ color: "var(--brand-text-secondary)" }}>
          נסו לרענן את העמוד
        </p>
      </div>
    );
  }

  return (
    <div className="pb-16">
      {/* Search */}
      <div className="px-4 pt-6 pb-2 flex justify-center">
        <div className="relative w-full max-w-md">
          <Search
            className="absolute top-1/2 -translate-y-1/2 end-4 w-4 h-4"
            style={{ color: "var(--brand-text-secondary)" }}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש מנות..."
            className="w-full py-2.5 ps-4 pe-10 outline-none transition-shadow"
            style={{
              borderRadius: 24,
              border: "1px solid var(--brand-border)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              backgroundColor: "var(--brand-bg-card)",
              color: "var(--text-color)",
            }}
            onFocus={(e) =>
              (e.currentTarget.style.boxShadow =
                "0 0 0 3px color-mix(in srgb, var(--brand-primary) 15%, var(--brand-bg))")
            }
            onBlur={(e) =>
              (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)")
            }
          />
        </div>
      </div>

      {searching ? (
        <SearchResults query={query} items={results} onClear={() => setQuery("")} />
      ) : (
        <>
          {/* Sticky category nav */}
          <nav
            className="sticky top-[60px] z-30 px-4 py-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{
              backgroundColor: "var(--brand-bg-card)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              borderBottom: "1px solid var(--brand-border)",
            }}
          >
            <div className="flex gap-2 w-max">
              {menu.map((cat) => {
                const active = cat.id === activeCat;
                return (
                  <button
                    key={cat.id}
                    onClick={() => scrollToCategory(cat.id)}
                    className="px-4 py-2.5 rounded-full whitespace-nowrap text-sm"
                    style={{
                      transition: "all 0.2s ease",
                      fontWeight: active ? 700 : 500,
                      backgroundColor: active
                        ? "var(--brand-primary)"
                        : "var(--brand-bg-card)",
                      color: active ? "#ffffff" : "var(--text-color)",
                      border: active
                        ? "1px solid transparent"
                        : "1px solid var(--brand-border)",
                      boxShadow: active
                        ? "0 2px 8px color-mix(in srgb, var(--brand-primary) 30%, var(--brand-bg))"
                        : "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Category sections */}
          <div className="px-4 mt-6 max-w-6xl mx-auto">
            {menu.map((cat) => (
              <section
                key={cat.id}
                data-cat-id={cat.id}
                ref={(el) => {
                  if (el) sectionRefs.current.set(cat.id, el);
                }}
                className="mb-10 scroll-mt-32"
              >
                <h2
                  className="text-xl font-bold mb-6 py-3 px-4"
                  style={{
                    backgroundColor: "var(--brand-bg-card)",
                    color: "var(--text-color)",
                    borderLeft: "4px solid var(--brand-primary)",
                    borderRadius: "0 8px 8px 0",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                  }}
                >
                  {cat.name}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {cat.items.map((item) => (
                    <ItemCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SearchResults({
  query,
  items,
  onClear,
}: {
  query: string;
  items: MenuItem[];
  onClear: () => void;
}) {
  return (
    <div className="px-4 mt-6 max-w-6xl mx-auto">
      <p className="mb-4 text-sm font-medium">
        🔍 נמצאו {items.length} תוצאות עבור &quot;{query}&quot;
      </p>
      {items.length === 0 ? (
        <div className="text-center py-16">
          <p className="font-bold">לא נמצאו תוצאות</p>
          <button
            onClick={onClear}
            className="mt-3 px-4 py-2 rounded-full text-sm font-medium text-white"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            נקה חיפוש
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function badgeColor(c: MenuItem["badge_color"]): string {
  switch (c) {
    case "accent": return "var(--brand-accent)";
    case "success": return "#16A34A";
    case "warning": return "#F59E0B";
    case "neutral": return "#6B7280";
    default: return "var(--brand-primary)";
  }
}

function ItemCard({ item }: { item: MenuItem }) {
  const unavailable = !item.is_available;
  const { openSheet, addLine } = useCart();

  function handleCardClick() {
    if (unavailable) return;
    if (item.option_groups.length > 0) openSheet(item);
    else addLine(item, 1, {});
  }

  return (
    <div
      onClick={handleCardClick}
      className="group flex gap-4 p-4 cursor-pointer"
      style={{
        backgroundColor: "var(--brand-bg-card)",
        borderRadius: 12,
        border: "1px solid var(--brand-border)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        minHeight: 140,
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "";
        e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)";
      }}
    >
      {/* Image side */}
      <div className="relative shrink-0">
        <div className="w-24 h-24 md:w-28 md:h-28 rounded-xl overflow-hidden shadow-lg flex items-center justify-center bg-gray-100">
          {item.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image_url}
              alt={item.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <span className="text-3xl">🍽️</span>
          )}
          {unavailable && (
            <div className="absolute inset-0 rounded-xl flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <span className="text-white text-xs font-bold">לא זמין כעת</span>
            </div>
          )}
        </div>
        {!unavailable && item.option_groups.length === 0 && (
          <button
            aria-label={`הוסף ${item.name}`}
            onClick={(e) => {
              e.stopPropagation();
              addLine(item, 1, {});
            }}
            className="absolute -bottom-1 -left-1 md:-bottom-2 md:-left-2 w-10 h-10 rounded-full flex items-center justify-center shadow-md transition-transform hover:scale-110"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            <Plus className="w-5 h-5 text-white" />
          </button>
        )}
      </div>

      {/* Details side */}
      <div className="flex flex-col flex-1 min-w-0">
        <h3 className="font-semibold text-base sm:text-lg" style={{ color: "var(--text-color)" }}>
          {item.name}
        </h3>
        {item.description && (
          <p
            className="text-xs sm:text-sm mt-2 line-clamp-2"
            style={{ color: "var(--brand-text-secondary)" }}
          >
            {item.description}
          </p>
        )}
        <div className="flex items-center gap-3 mt-auto pt-3">
          <span
            className="font-bold text-lg sm:text-xl"
            style={{ color: "var(--brand-primary)" }}
          >
            {formatPrice(item.price)}
          </span>
          {item.badge_label && (
            <span
              className="px-2 py-1 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: badgeColor(item.badge_color) }}
            >
              {item.badge_label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
