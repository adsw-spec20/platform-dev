"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { MenuItem } from "@/lib/types";
import { calcLinePrice, type Selections } from "@/lib/pricing";

export type CartLine = {
  lineId: string;
  item: MenuItem; // snapshot for display + client-side estimate (server reprices)
  qty: number;
  selections: Selections;
  notes?: string;
};

type CartState = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  addLine: (item: MenuItem, qty: number, selections: Selections, notes?: string) => void;
  updateLine: (lineId: string, qty: number, selections: Selections, notes?: string) => void;
  removeLine: (lineId: string) => void;
  setQty: (lineId: string, qty: number) => void;
  clear: () => void;
  // UI state
  sheetItem: MenuItem | null;
  editingLine: CartLine | null;
  openSheet: (item: MenuItem, line?: CartLine) => void;
  closeSheet: () => void;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
};

const CartContext = createContext<CartState | null>(null);

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart outside CartProvider");
  return ctx;
}

export function CartProvider({
  tenantSlug,
  children,
}: {
  tenantSlug: string;
  children: React.ReactNode;
}) {
  const storageKey = `cart:${tenantSlug}`;
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [sheetItem, setSheetItem] = useState<MenuItem | null>(null);
  const [editingLine, setEditingLine] = useState<CartLine | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setLines(JSON.parse(raw));
    } catch {
      /* corrupted cart -> start fresh */
    }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(storageKey, JSON.stringify(lines));
  }, [lines, hydrated, storageKey]);

  const addLine = useCallback(
    (item: MenuItem, qty: number, selections: Selections, notes?: string) => {
      setLines((prev) => [
        ...prev,
        { lineId: crypto.randomUUID(), item, qty, selections, notes },
      ]);
    },
    []
  );

  const updateLine = useCallback(
    (lineId: string, qty: number, selections: Selections, notes?: string) => {
      setLines((prev) =>
        prev.map((l) => (l.lineId === lineId ? { ...l, qty, selections, notes } : l))
      );
    },
    []
  );

  const removeLine = useCallback((lineId: string) => {
    setLines((prev) => prev.filter((l) => l.lineId !== lineId));
  }, []);

  const setQty = useCallback((lineId: string, qty: number) => {
    setLines((prev) =>
      prev
        .map((l) => (l.lineId === lineId ? { ...l, qty: Math.max(0, qty) } : l))
        .filter((l) => l.qty > 0)
    );
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const openSheet = useCallback((item: MenuItem, line?: CartLine) => {
    setSheetItem(item);
    setEditingLine(line ?? null);
  }, []);
  const closeSheet = useCallback(() => {
    setSheetItem(null);
    setEditingLine(null);
  }, []);

  const { count, subtotal } = useMemo(() => {
    let c = 0;
    let s = 0;
    for (const l of lines) {
      c += l.qty;
      s += calcLinePrice(l.item, l.selections, l.qty);
    }
    return { count: c, subtotal: s };
  }, [lines]);

  return (
    <CartContext.Provider
      value={{
        lines, count, subtotal,
        addLine, updateLine, removeLine, setQty, clear,
        sheetItem, editingLine, openSheet, closeSheet,
        drawerOpen, setDrawerOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
