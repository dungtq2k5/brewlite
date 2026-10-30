import { MAX_LINES_PER_ORDER, MAX_QTY_PER_LINE, PRODUCT_SIZES } from '@brewlite/contracts';
import { CART_STORAGE_KEY } from '../cart-key';
import { EMPTY_CART, keyOf, type Cart, type CartLine } from './cart';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is { en: string; vi: string } =>
  isRecord(v) && typeof v.en === 'string' && typeof v.vi === 'string';
const isMoney = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

function isLine(v: unknown): v is CartLine {
  if (!isRecord(v)) return false;
  const { toppings } = v;
  return (
    typeof v.key === 'string' &&
    typeof v.productId === 'string' &&
    typeof v.categoryId === 'string' &&
    Number.isInteger(v.noPhoto) &&
    (v.noPhoto as number) >= 0 &&
    (v.noPhoto as number) < 5 &&
    isText(v.name) &&
    (v.imageUrl === null || typeof v.imageUrl === 'string') &&
    (PRODUCT_SIZES as readonly unknown[]).includes(v.size) &&
    isMoney(v.basePriceVnd) &&
    isMoney(v.sizeDeltaVnd) &&
    Number.isInteger(v.quantity) &&
    (v.quantity as number) >= 1 &&
    (v.quantity as number) <= MAX_QTY_PER_LINE &&
    Array.isArray(toppings) &&
    toppings.every(
      (t) => isRecord(t) && typeof t.id === 'string' && isText(t.name) && isMoney(t.priceVnd),
    ) &&
    // A key that does not match its own line would merge the wrong lines.
    v.key === keyOf(v as unknown as CartLine)
  );
}

/**
 * Anything that is not `{ v: 1, lines }` with valid, distinct lines (at most 20) is an empty
 * cart — a corrupt or old-shape value never breaks the page (conventions §11.2).
 */
export function parseCart(raw: string | null): Cart {
  if (!raw) return EMPTY_CART;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.v !== 1 || !Array.isArray(parsed.lines)) return EMPTY_CART;
    const lines = parsed.lines;
    if (lines.length > MAX_LINES_PER_ORDER || !lines.every(isLine)) return EMPTY_CART;
    if (new Set(lines.map((l) => l.key)).size !== lines.length) return EMPTY_CART;
    if (parsed.placedOrderId !== undefined && typeof parsed.placedOrderId !== 'string') {
      return EMPTY_CART;
    }
    return {
      v: 1,
      lines,
      ...(parsed.placedOrderId !== undefined && { placedOrderId: parsed.placedOrderId }),
    };
  } catch {
    return EMPTY_CART;
  }
}

/** The part of `Storage` the cart uses — a test passes a throwing one. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** `window.localStorage`, or `null` when the browser refuses even to hand it over. */
export function browserStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Reads and writes the stored cart. Storage that throws (private mode, blocked site data)
 * never surfaces: the cart then lives in memory for the visit and nothing is said
 * (handoff §3.11). `write` says whether it reached storage.
 */
export function createCartStorage(getStorage: () => StorageLike | null = browserStorage) {
  return {
    read(): Cart | null {
      try {
        const storage = getStorage();
        return storage ? parseCart(storage.getItem(CART_STORAGE_KEY)) : null;
      } catch {
        return null;
      }
    },
    write(cart: Cart): boolean {
      try {
        const storage = getStorage();
        if (!storage) return false;
        // An empty cart is no cart — even one that was marked as placed.
        if (cart.lines.length === 0) storage.removeItem(CART_STORAGE_KEY);
        else storage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
        return true;
      } catch {
        return false;
      }
    },
  };
}

/** Raised by `clearCart()` (sign-out) so a mounted provider re-reads storage. */
export const CART_EVENT = 'bl-cart-change';

export function itemsInStorage(): number {
  const cart = createCartStorage().read();
  return cart ? cart.lines.reduce((n, l) => n + l.quantity, 0) : 0;
}

export function clearCart(): void {
  try {
    browserStorage()?.removeItem(CART_STORAGE_KEY);
  } catch {
    // Blocked storage: there is nothing to clear.
  }
  window.dispatchEvent(new Event(CART_EVENT));
}
