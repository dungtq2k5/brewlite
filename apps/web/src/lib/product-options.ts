import { PRODUCT_SIZES, computeUnitPrice } from '@brewlite/contracts';
import type { Cart } from './cart/cart';
import { canAdd, quantityOf } from './cart/cart';

export interface OfferedSize {
  size: string;
  priceDeltaVnd: number;
}

const ORDER = new Map<string, number>(PRODUCT_SIZES.map((s, i) => [s, i]));

/** The sizes the product offers, S → L whatever order the API sent them in. */
export const sortSizes = <T extends { size: string }>(sizes: readonly T[]): T[] =>
  [...sizes].sort((a, b) => (ORDER.get(a.size) ?? 99) - (ORDER.get(b.size) ?? 99));

/** The total on the button: the one unit-price rule, times the quantity. */
export const addTotalVnd = (
  basePriceVnd: number,
  sizeDeltaVnd: number,
  toppingPricesVnd: readonly number[],
  quantity: number,
): number => computeUnitPrice(basePriceVnd, sizeDeltaVnd, toppingPricesVnd) * quantity;

/**
 * What the add button can do for the combination on screen:
 * - `soldOut`  the product is out for today
 * - `lineFull` an identical line is already at the quantity cap
 * - `cartFull` this is a new line and the cart already has 20
 * - `loading`  the stored cart is not read yet — a tap would write over it
 * - `ready`    it adds (or raises a line)
 */
export type AddState = 'ready' | 'soldOut' | 'lineFull' | 'cartFull' | 'loading';

export function addState(soldOut: boolean, cartReady: boolean, cart: Cart, key: string): AddState {
  if (soldOut) return 'soldOut';
  if (!cartReady) return 'loading';
  if (canAdd(cart, key)) return 'ready';
  return quantityOf(cart, key) > 0 ? 'lineFull' : 'cartFull';
}
