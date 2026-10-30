'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  MAX_LINES_PER_ORDER,
  MAX_QTY_PER_LINE,
  MAX_TOPPINGS_PER_LINE,
  type ProductSize,
} from '@brewlite/contracts';
import type { LocalizedText } from '@/lib/gateway-types';

const CART_STORAGE_KEY = 'brewlite_cart';

/** One cart line: product + size + toppings + quantity (ADR 0015). */
export interface CartItem {
  id: string;
  productId: string;
  name: LocalizedText;
  size: ProductSize;
  toppingIds: string[];
  toppingNames: LocalizedText[];
  qty: number;
  basePriceVnd: number;
  sizeDeltaVnd: number;
  toppingsPriceVnd: number;
  unitPriceVnd: number;
}

interface CartContextType {
  items: CartItem[];
  hydrated: boolean;
  addItem: (item: Omit<CartItem, 'id' | 'unitPriceVnd'>) => boolean;
  removeItem: (id: string) => void;
  updateQty: (id: string, delta: number) => void;
  clearCart: () => void;
  previewSubtotalVnd: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function normalizeText(value: unknown): LocalizedText {
  if (typeof value === 'string') return { en: value, vi: value };
  if (value && typeof value === 'object') {
    const text = value as Partial<LocalizedText>;
    return { en: text.en ?? text.vi ?? '', vi: text.vi ?? text.en ?? '' };
  }
  return { en: '', vi: '' };
}

function readStoredCart(): CartItem[] {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
      .map((row) => {
        const size = (['S', 'M', 'L'].includes(String(row.size)) ? row.size : 'M') as ProductSize;
        const qty = Math.min(MAX_QTY_PER_LINE, Math.max(1, Number(row.qty) || 1));
        const basePriceVnd = Number(row.basePriceVnd) || 0;
        const sizeDeltaVnd = Number(row.sizeDeltaVnd) || 0;
        const toppingsPriceVnd = Number(row.toppingsPriceVnd) || 0;
        const toppingIds = Array.isArray(row.toppingIds) ? row.toppingIds.map(String) : [];
        const toppingNames = Array.isArray(row.toppingNames)
          ? row.toppingNames.map(normalizeText)
          : [];
        return {
          id: String(row.id ?? ''),
          productId: String(row.productId ?? ''),
          name: normalizeText(row.name),
          size,
          toppingIds,
          toppingNames,
          qty,
          basePriceVnd,
          sizeDeltaVnd,
          toppingsPriceVnd,
          unitPriceVnd: basePriceVnd + sizeDeltaVnd + toppingsPriceVnd,
        };
      })
      .filter((item) => item.id && item.productId);
  } catch {
    return [];
  }
}

function storedCartJson(items: CartItem[]): string {
  return JSON.stringify(items);
}

/** Holds the browser-owned cart; it survives reloads and sign-in (ADR 0029). */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  // Mutations read the latest cart synchronously so two quick adds cannot race
  // past MAX_LINES_PER_ORDER before React commits the previous update.
  const itemsRef = useRef<CartItem[]>([]);

  const commit = (next: CartItem[]) => {
    itemsRef.current = next;
    setItems(next);
  };

  useEffect(() => {
    const stored = readStoredCart();
    itemsRef.current = stored;
    setItems(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const serialized = storedCartJson(items);
    try {
      // Another tab may have written a newer cart; only write when this tab's state
      // actually differs, so the two tabs cannot ping-pong storage events.
      if (localStorage.getItem(CART_STORAGE_KEY) !== serialized) {
        localStorage.setItem(CART_STORAGE_KEY, serialized);
      }
    } catch {
      // A blocked storage leaves the in-memory cart usable for this visit.
    }
  }, [items, hydrated]);

  // Keep every open tab on the same cart. `storage` fires only in the other tabs, which
  // is exactly what a second tab needs; `visibilitychange` covers a suspended tab that
  // missed the event while it was frozen.
  useEffect(() => {
    const sync = () => {
      const next = readStoredCart();
      if (storedCartJson(next) === storedCartJson(itemsRef.current)) return;
      itemsRef.current = next;
      setItems(next);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === CART_STORAGE_KEY) sync();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync();
    };

    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const addItem = (newItem: Omit<CartItem, 'id' | 'unitPriceVnd'>) => {
    if (newItem.toppingIds.length > MAX_TOPPINGS_PER_LINE) return false;

    const unitPriceVnd = newItem.basePriceVnd + newItem.sizeDeltaVnd + newItem.toppingsPriceVnd;
    const id = `${newItem.productId}-${newItem.size}-${[...newItem.toppingIds].sort().join('_')}`;
    const current = itemsRef.current;
    const existing = current.find((item) => item.id === id);
    if (!existing && current.length >= MAX_LINES_PER_ORDER) return false;

    if (existing) {
      commit(
        current.map((item) =>
          item.id === id
            ? { ...item, qty: Math.min(MAX_QTY_PER_LINE, item.qty + newItem.qty) }
            : item,
        ),
      );
      return true;
    }

    commit([
      ...current,
      { ...newItem, id, qty: Math.min(MAX_QTY_PER_LINE, newItem.qty), unitPriceVnd },
    ]);
    return true;
  };

  const removeItem = (id: string) => {
    commit(itemsRef.current.filter((item) => item.id !== id));
  };

  const updateQty = (id: string, delta: number) => {
    commit(
      itemsRef.current
        .map((item) => {
          if (item.id !== id) return item;
          const nextQty = item.qty + delta;
          if (nextQty <= 0) return null;
          return { ...item, qty: Math.min(MAX_QTY_PER_LINE, nextQty) };
        })
        .filter((item): item is CartItem => item !== null),
    );
  };

  const clearCart = () => commit([]);

  const previewSubtotalVnd = useMemo(
    () => items.reduce((acc, item) => acc + item.unitPriceVnd * item.qty, 0),
    [items],
  );

  return (
    <CartContext.Provider
      value={{
        items,
        hydrated,
        addItem,
        removeItem,
        updateQty,
        clearCart,
        previewSubtotalVnd,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

/** Reads the cart; throws outside the customer layout's provider. */
export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
}
