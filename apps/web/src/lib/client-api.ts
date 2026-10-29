const PENDING_ORDER_KEY = 'brewlite_pending_order';

/**
 * Remembers the order this browser just placed, so a later `PAID` status clears the
 * cart only for that order — opening an old paid order must not empty a fresh cart.
 */
export function savePendingOrder(orderId: string): void {
  try {
    localStorage.setItem(PENDING_ORDER_KEY, orderId);
  } catch {
    // Without storage the cart simply stays until the next visit.
  }
}

export function readPendingOrder(): string | null {
  try {
    return localStorage.getItem(PENDING_ORDER_KEY);
  } catch {
    return null;
  }
}

export function clearPendingOrder(): void {
  try {
    localStorage.removeItem(PENDING_ORDER_KEY);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
