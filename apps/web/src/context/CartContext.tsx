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
  imageUrl?: string | null;
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
  updateItem: (id: string, item: Omit<CartItem, 'id' | 'unitPriceVnd'>) => 'updated' | 'merged';
  removeItem: (id: string) => void;
  updateQty: (id: string, delta: number) => void;
  clearCart: () => void;
  previewSubtotalVnd: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function cartLineId(item: Pick<CartItem, 'productId' | 'size' | 'toppingIds'>): string {
  return `${item.productId}-${item.size}-${[...item.toppingIds].sort().join('_')}`;
}

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
          imageUrl:
            typeof row.imageUrl === 'string' && row.imageUrl.length > 0 ? row.imageUrl : null,
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

  // Carts saved before product thumbnails existed (or edited on another device) get
  // their image back from the public menu once, then keep it in local storage.
  useEffect(() => {
    if (!hydrated) return;
    if (!itemsRef.current.some((item) => !item.imageUrl)) return;

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/v1/products', { cache: 'no-store' });
        if (!response.ok) return;
        const body: unknown = await response.json();
        if (!body || typeof body !== 'object') return;
        const rows = (body as { data?: unknown }).data;
        if (!Array.isArray(rows)) return;

        const imageByProduct = new Map<string, string>();
        for (const row of rows) {
          if (!row || typeof row !== 'object') continue;
          const { id, imageUrl } = row as { id?: unknown; imageUrl?: unknown };
          if (typeof id === 'string' && typeof imageUrl === 'string' && imageUrl) {
            imageByProduct.set(id, imageUrl);
          }
        }
        if (cancelled || imageByProduct.size === 0) return;

        let changed = false;
        const next = itemsRef.current.map((item) => {
          if (item.imageUrl) return item;
          const imageUrl = imageByProduct.get(item.productId);
          if (!imageUrl) return item;
          changed = true;
          return { ...item, imageUrl };
        });
        if (!changed) return;
        itemsRef.current = next;
        setItems(next);
      } catch {
        // A failed lookup only leaves the illustration fallback in place.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated]);

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
    const id = cartLineId(newItem);
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

  const updateItem = (
    id: string,
    newItem: Omit<CartItem, 'id' | 'unitPriceVnd'>,
  ): 'updated' | 'merged' => {
    const unitPriceVnd = newItem.basePriceVnd + newItem.sizeDeltaVnd + newItem.toppingsPriceVnd;
    const nextId = cartLineId(newItem);
    const current = itemsRef.current;
    const target = current.find((item) => item.id === id);
    if (!target) return 'updated';

    const duplicate = nextId === id ? null : current.find((item) => item.id === nextId);
    if (duplicate) {
      commit(
        current
          .filter((item) => item.id !== id)
          .map((item) =>
            item.id === nextId
              ? { ...item, qty: Math.min(MAX_QTY_PER_LINE, item.qty + newItem.qty) }
              : item,
          ),
      );
      return 'merged';
    }

    commit(
      current.map((item) =>
        item.id === id
          ? {
              ...newItem,
              id: nextId,
              qty: Math.min(MAX_QTY_PER_LINE, newItem.qty),
              unitPriceVnd,
            }
          : item,
      ),
    );
    return 'updated';
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
        updateItem,
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
