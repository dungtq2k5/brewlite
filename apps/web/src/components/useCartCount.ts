'use client';

import { useSyncExternalStore } from 'react';
import { CART_STORAGE_KEY } from '@/lib/cart-key';

const EVENT = 'bl-cart-change';

/** Sum of line quantities in `localStorage['bl_cart']`; 0 when absent, blocked or unreadable. */
export function readCartCount(): number {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return 0;
    const parsed: unknown = JSON.parse(raw);
    const lines = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { lines?: unknown }).lines)
        ? (parsed as { lines: unknown[] }).lines
        : [];
    return lines.reduce<number>((sum, line) => {
      const quantity = (line as { quantity?: unknown } | null)?.quantity;
      return sum + (typeof quantity === 'number' && quantity > 0 ? quantity : 0);
    }, 0);
  } catch {
    return 0;
  }
}

export function clearCart(): void {
  try {
    window.localStorage.removeItem(CART_STORAGE_KEY);
  } catch {
    // Blocked storage: there is nothing to clear.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/** A tiny hook for now; the cart provider replaces it and keeps the same storage key. */
export function useCartCount(): number {
  return useSyncExternalStore(subscribe, readCartCount, () => 0);
}
