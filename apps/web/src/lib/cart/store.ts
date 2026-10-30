import {
  EMPTY_CART,
  add as addToCart,
  remove as removeFromCart,
  restore as restoreToCart,
  setQuantity as setCartQuantity,
  type AddResult,
  type Cart,
  type CartLine,
  type NewLine,
  type RemoveResult,
} from './cart';
import { createCartStorage } from './storage';

export interface CartSnapshot {
  cart: Cart;
  /** False until the stored cart has been read — the server's HTML never knows it. */
  ready: boolean;
}

const SERVER_SNAPSHOT: CartSnapshot = { cart: EMPTY_CART, ready: false };

/**
 * The cart's single source of truth on the page: an external store that
 * `useSyncExternalStore` reads, persisted through `createCartStorage()`. It exists apart
 * from React so the rules can be tested without rendering anything.
 */
export function createCartStore(storage = createCartStorage()) {
  let snapshot: CartSnapshot = SERVER_SNAPSHOT;
  const listeners = new Set<() => void>();

  const publish = (next: CartSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };

  /** A change made before the first read would overwrite the stored cart with an empty one. */
  const ensureLoaded = () => {
    if (!snapshot.ready) publish({ cart: storage.read() ?? EMPTY_CART, ready: true });
  };

  /** A change made here: kept in memory first, then written if storage allows. */
  const commit = (cart: Cart) => {
    if (cart === snapshot.cart) return;
    publish({ cart, ready: true });
    storage.write(cart);
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => SERVER_SNAPSHOT,

    /** On mount, and when another tab or `clearCart()` changed storage. */
    load(fallback: Cart = snapshot.ready ? snapshot.cart : EMPTY_CART) {
      publish({ cart: storage.read() ?? fallback, ready: true });
    },
    /** `clearCart()` ran: an unreadable storage means the in-memory cart goes too. */
    reload() {
      publish({ cart: storage.read() ?? EMPTY_CART, ready: true });
    },

    add(line: NewLine, quantity: number): AddResult {
      ensureLoaded();
      const result = addToCart(snapshot.cart, line, quantity);
      commit(result.cart);
      return result;
    },
    setQuantity(key: string, quantity: number) {
      ensureLoaded();
      commit(setCartQuantity(snapshot.cart, key, quantity));
    },
    remove(key: string): RemoveResult {
      ensureLoaded();
      const result = removeFromCart(snapshot.cart, key);
      commit(result.cart);
      return result;
    },
    restore(line: CartLine, index: number) {
      ensureLoaded();
      commit(restoreToCart(snapshot.cart, line, index));
    },
  };
}

export type CartStore = ReturnType<typeof createCartStore>;
