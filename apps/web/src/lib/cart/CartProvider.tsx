'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { itemCount as countItems, lineCount as countLines, type Cart } from './cart';
import { CART_EVENT } from './storage';
import { createCartStore, type CartStore } from './store';

interface CartContextValue {
  cart: Cart;
  /** False until the stored cart is read: render a neutral state, never "empty", before that. */
  ready: boolean;
  itemCount: number;
  lineCount: number;
  add: CartStore['add'];
  setQuantity: CartStore['setQuantity'];
  remove: CartStore['remove'];
  restore: CartStore['restore'];
}

const CartContext = createContext<CartContextValue | null>(null);

/**
 * The cart for the customer pages (architecture §4.3), persisted in `localStorage['bl_cart']`.
 * Loaded after mount, so the server's HTML and the first client render match; a second tab and
 * `clearCart()` (sign-out) keep it in step.
 */
export function CartProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [store] = useState(createCartStore);
  const { cart, ready } = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  useEffect(() => {
    store.load();
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === 'bl_cart') store.load();
    };
    const onClear = () => store.reload();
    window.addEventListener('storage', onStorage);
    window.addEventListener(CART_EVENT, onClear);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CART_EVENT, onClear);
    };
  }, [store]);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      ready,
      itemCount: countItems(cart),
      lineCount: countLines(cart),
      add: store.add,
      setQuantity: store.setQuantity,
      remove: store.remove,
      restore: store.restore,
    }),
    [cart, ready, store],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart needs <CartProvider> — it lives in the customer shell');
  return value;
}
