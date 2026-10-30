import { ProductSize } from '@brewlite/contracts';
import { describe, expect, it } from 'vitest';
import {
  EMPTY_CART,
  add,
  canAdd,
  clearIfPlaced,
  itemCount,
  keyOf,
  lineCount,
  lineKey,
  lineTotalVnd,
  markPlaced,
  quantityOf,
  remove,
  restore,
  setQuantity,
  totalVnd,
  unitPriceVnd,
} from './cart';
import { newLine, topping } from './fixtures';

describe('merging', () => {
  it('merges identical lines, whatever order the toppings were picked in', () => {
    const a = newLine({ toppings: [topping('b'), topping('a')] });
    const b = newLine({ toppings: [topping('a'), topping('b')] });
    expect(keyOf(a)).toBe(keyOf(b));
    const { cart } = add(add(EMPTY_CART, a, 1).cart, b, 2);
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]!.quantity).toBe(3);
  });

  it('keeps a different size or topping set as its own line', () => {
    let cart = add(EMPTY_CART, newLine(), 1).cart;
    cart = add(cart, newLine({ size: ProductSize.L, sizeDeltaVnd: 10_000 }), 1).cart;
    cart = add(cart, newLine({ toppings: [topping('a')] }), 1).cart;
    expect(lineCount(cart)).toBe(3);
  });

  it('builds the key as product | size | sorted topping ids', () => {
    expect(lineKey('p', 'M', ['z', 'a'])).toBe('p|M|a,z');
    expect(lineKey('p', 'M', [])).toBe('p|M|');
  });
});

describe('the quantity cap', () => {
  it('stops at 10 and says how many it really added', () => {
    let cart = add(EMPTY_CART, newLine(), 9).cart;
    const result = add(cart, newLine(), 3);
    expect(result.added).toBe(1);
    expect(result.cart.lines[0]!.quantity).toBe(10);
    cart = result.cart;
    expect(add(cart, newLine(), 1)).toEqual({ cart, added: 0 });
  });

  it('a new line asked for more than 10 starts at 10', () => {
    expect(add(EMPTY_CART, newLine(), 25).added).toBe(10);
  });

  it('adds nothing for a zero or negative request', () => {
    expect(add(EMPTY_CART, newLine(), 0).added).toBe(0);
    expect(add(EMPTY_CART, newLine(), -3).added).toBe(0);
  });

  it('the stepper clamps to 1…10 and ignores an unknown key', () => {
    const cart = add(EMPTY_CART, newLine(), 2).cart;
    const key = cart.lines[0]!.key;
    expect(quantityOf(setQuantity(cart, key, 99), key)).toBe(10);
    expect(quantityOf(setQuantity(cart, key, 0), key)).toBe(1);
    expect(setQuantity(cart, 'nope', 5)).toBe(cart);
  });
});

describe('the 20-line limit counts lines, not items', () => {
  const full = () => {
    let cart = EMPTY_CART;
    for (let i = 0; i < 20; i++) cart = add(cart, newLine({ productId: `p${i}` }), 1).cart;
    return cart;
  };

  it('refuses a 21st distinct line', () => {
    const cart = full();
    const result = add(cart, newLine({ productId: 'p-new' }), 1);
    expect(result.added).toBe(0);
    expect(result.cart).toBe(cart);
    expect(canAdd(cart, lineKey('p-new', 'S', []))).toBe(false);
  });

  it('still raises the quantity of an identical line when full', () => {
    const cart = full();
    expect(canAdd(cart, lineKey('p3', 'S', []))).toBe(true);
    expect(add(cart, newLine({ productId: 'p3' }), 2).added).toBe(2);
  });

  it('a line at 10 cannot be added to', () => {
    const cart = add(EMPTY_CART, newLine(), 10).cart;
    expect(canAdd(cart, cart.lines[0]!.key)).toBe(false);
  });
});

describe('counts and totals', () => {
  it('items are the sum of quantities, lines are distinct lines', () => {
    let cart = add(EMPTY_CART, newLine(), 10).cart;
    expect(itemCount(cart)).toBe(10);
    expect(lineCount(cart)).toBe(1);
    cart = add(cart, newLine({ productId: 'p2' }), 3).cart;
    expect(itemCount(cart)).toBe(13);
    expect(lineCount(cart)).toBe(2);
  });

  it('prices a unit through computeUnitPrice: base + size + toppings', () => {
    const line = newLine({
      sizeDeltaVnd: 6_000,
      toppings: [topping('a', 8_000), topping('b', 5_000)],
    });
    expect(unitPriceVnd(line)).toBe(29_000 + 6_000 + 13_000);
    const cart = add(EMPTY_CART, line, 2).cart;
    expect(lineTotalVnd(cart.lines[0]!)).toBe(96_000);
    expect(totalVnd(cart)).toBe(96_000);
  });

  it('leaves out the lines the server called unavailable', () => {
    let cart = add(EMPTY_CART, newLine(), 1).cart;
    cart = add(cart, newLine({ productId: 'p2', basePriceVnd: 10_000 }), 1).cart;
    expect(totalVnd(cart, new Set([cart.lines[0]!.key]))).toBe(10_000);
  });
});

describe('remove and restore (Undo)', () => {
  const three = () => {
    let cart = EMPTY_CART;
    for (const id of ['a', 'b', 'c']) cart = add(cart, newLine({ productId: id }), 2).cart;
    return cart;
  };

  it('puts a removed line back at its place', () => {
    const cart = three();
    const { cart: without, removed } = remove(cart, cart.lines[1]!.key);
    expect(without.lines.map((l) => l.productId)).toEqual(['a', 'c']);
    expect(restore(without, removed!.line, removed!.index)).toEqual(cart);
  });

  it('merges into a line added again in the meantime, capped at 10', () => {
    const cart = add(EMPTY_CART, newLine(), 8).cart;
    const { cart: without, removed } = remove(cart, cart.lines[0]!.key);
    const again = add(without, newLine(), 4).cart;
    expect(restore(again, removed!.line, removed!.index).lines[0]!.quantity).toBe(10);
  });

  it('does nothing when the cart filled up meanwhile', () => {
    const cart = add(EMPTY_CART, newLine({ productId: 'gone' }), 1).cart;
    const { cart: without, removed } = remove(cart, cart.lines[0]!.key);
    let full = without;
    for (let i = 0; i < 20; i++) full = add(full, newLine({ productId: `p${i}` }), 1).cart;
    expect(restore(full, removed!.line, 0)).toBe(full);
  });

  it('removing an unknown key changes nothing', () => {
    const cart = three();
    expect(remove(cart, 'nope')).toEqual({ cart });
  });
});

describe('the placed-order marker', () => {
  const placed = () => markPlaced(add(EMPTY_CART, newLine(), 2).cart, 'order-1');

  it('marks the cart without emptying it', () => {
    const cart = placed();
    expect(cart.placedOrderId).toBe('order-1');
    expect(itemCount(cart)).toBe(2);
  });

  it('is cleared when that order is seen paid', () => {
    expect(clearIfPlaced(placed(), 'order-1')).toBe(EMPTY_CART);
  });

  it("keeps the cart when another order's id is seen (an old paid order from history)", () => {
    const cart = placed();
    expect(clearIfPlaced(cart, 'order-0')).toBe(cart);
  });

  it('every edit drops the marker, so an edited cart is not the one that was paid for', () => {
    const cart = placed();
    const key = cart.lines[0]!.key;
    expect(add(cart, newLine(), 1).cart.placedOrderId).toBeUndefined();
    expect(setQuantity(cart, key, 5).placedOrderId).toBeUndefined();
    expect(add(cart, newLine({ productId: 'p2' }), 1).cart.placedOrderId).toBeUndefined();
    const { cart: without, removed } = remove(cart, key);
    expect(without.placedOrderId).toBeUndefined();
    expect(restore(without, removed!.line, 0).placedOrderId).toBeUndefined();
    expect(clearIfPlaced(setQuantity(cart, key, 5), 'order-1').lines).toHaveLength(1);
  });

  it('a change that changes nothing keeps it', () => {
    const cart = placed();
    expect(setQuantity(cart, 'unknown', 3)).toBe(cart);
    expect(add(cart, newLine(), 0).cart).toBe(cart);
  });
});
