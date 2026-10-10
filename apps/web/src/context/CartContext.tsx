'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

export const MAX_TOPPINGS_PER_LINE = 3;

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  size: 'S' | 'M' | 'L';
  toppingIds: string[];
  toppingNames: string[];
  qty: number;
  basePriceVnd: number;
  sizeDeltaVnd: number;
  toppingsPriceVnd: number;
  unitPriceVnd: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'id' | 'unitPriceVnd'>) => boolean;
  removeItem: (id: string) => void;
  updateQty: (id: string, delta: number) => void;
  clearCart: () => void;
  previewSubtotalVnd: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('brewlite_cart');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('brewlite_cart', JSON.stringify(items));
    } catch {
      // ignore
    }
  }, [items]);

  const addItem = (newItem: Omit<CartItem, 'id' | 'unitPriceVnd'>) => {
    if (newItem.toppingIds.length > MAX_TOPPINGS_PER_LINE) return false;

    const unitPriceVnd = newItem.basePriceVnd + newItem.sizeDeltaVnd + newItem.toppingsPriceVnd;
    const id = `${newItem.productId}-${newItem.size}-${[...newItem.toppingIds].sort().join('_')}`;

    setItems((prev) => {
      const idx = prev.findIndex((item) => item.id === id);
      if (idx > -1) {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          qty: updated[idx].qty + newItem.qty,
        };
        return updated;
      }
      return [...prev, { ...newItem, id, unitPriceVnd }];
    });
    return true;
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateQty = (id: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.qty + delta;
            return newQty > 0 ? { ...item, qty: newQty } : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null),
    );
  };

  const clearCart = () => setItems([]);

  const previewSubtotalVnd = useMemo(() => {
    return items.reduce((acc, cur) => acc + cur.unitPriceVnd * cur.qty, 0);
  }, [items]);

  return (
    <CartContext.Provider
      value={{
        items,
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

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
}
