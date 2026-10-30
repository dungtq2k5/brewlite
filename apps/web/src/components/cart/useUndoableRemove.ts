'use client';

import { useCallback, useState } from 'react';
import { useCart } from '@/lib/cart/CartProvider';
import type { CartLine } from '@/lib/cart/cart';

interface Removed {
  line: CartLine;
  index: number;
}

/**
 * *Remove* is instant and leaves a five-second *Undo* in the line's place. One at a time:
 * removing a second line lets the first go for good. Shared by the cart and the checkout.
 */
export function useUndoableRemove() {
  const { remove, restore } = useCart();
  const [removed, setRemoved] = useState<Removed | null>(null);

  const expire = useCallback(() => setRemoved(null), []);
  const onRemove = (key: string) => {
    const result = remove(key);
    if (result.removed) setRemoved(result.removed);
  };
  const onUndo = () => {
    if (!removed) return;
    restore(removed.line, removed.index);
    setRemoved(null);
  };
  return { removed, onRemove, onUndo, expire };
}
