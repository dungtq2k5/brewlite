import { ProductSize } from '@brewlite/contracts';
import { describe, expect, it } from 'vitest';
import { add, EMPTY_CART } from '../cart/cart';
import { newLine, topping } from '../cart/fixtures';
import { mapRefusal, stockLeftFor, toQuoteItems, unavailableFor } from './refusals';

const cart = [
  newLine({ productId: 'latte' }),
  newLine({ productId: 'tea', size: ProductSize.M, toppings: [topping('b'), topping('a')] }),
  newLine({ productId: 'latte', size: ProductSize.L }),
].reduce((c, l) => add(c, l, 2).cart, EMPTY_CART).lines;

describe('toQuoteItems', () => {
  it('keeps the cart order and maps quantity to qty', () => {
    expect(toQuoteItems(cart)).toEqual([
      { productId: 'latte', size: 'S', toppingIds: [], qty: 2 },
      { productId: 'tea', size: 'M', toppingIds: ['b', 'a'], qty: 2 },
      { productId: 'latte', size: 'L', toppingIds: [], qty: 2 },
    ]);
  });
});

describe('mapRefusal', () => {
  it('marks every line of an unavailable product', () => {
    const refusal = mapRefusal('PRODUCT_UNAVAILABLE', { productIds: ['latte'] }, cart);
    expect(refusal).toEqual({ kind: 'products', lineKeys: [cart[0]!.key, cart[2]!.key] });
    expect(unavailableFor(refusal, cart[0]!)).toEqual({ code: 'PRODUCT_UNAVAILABLE' });
    expect(unavailableFor(refusal, cart[1]!)).toBeUndefined();
  });

  it('marks the line at lineIndex — a cart index', () => {
    const refusal = mapRefusal('OPTION_INVALID', { lineIndex: 1, reason: 'TOPPING' }, cart);
    expect(refusal).toEqual({ kind: 'option', lineKey: cart[1]!.key, reason: 'TOPPING' });
    expect(unavailableFor(refusal, cart[1]!)).toEqual({
      code: 'OPTION_INVALID',
      reason: 'TOPPING',
    });
    expect(unavailableFor(refusal, cart[0]!)).toBeUndefined();
  });

  it('an index that is not in the cart is a generic failure, never a wrong line', () => {
    expect(mapRefusal('OPTION_INVALID', { lineIndex: 9, reason: 'SIZE' }, cart)).toEqual({
      kind: 'failed',
      code: 'OPTION_INVALID',
    });
  });

  it('gives each line of a short product what is left, keeping the stepper', () => {
    const refusal = mapRefusal(
      'OUT_OF_STOCK',
      { products: [{ productId: 'latte', available: 1 }] },
      cart,
    );
    expect(stockLeftFor(refusal, cart[0]!)).toBe(1);
    expect(stockLeftFor(refusal, cart[2]!)).toBe(1);
    expect(stockLeftFor(refusal, cart[1]!)).toBeUndefined();
    expect(unavailableFor(refusal, cart[0]!)).toBeUndefined();
  });

  it('reads the promo reason and its minimum', () => {
    expect(
      mapRefusal('PROMO_CODE_INVALID', { reason: 'MIN_SUBTOTAL', minSubtotalVnd: 50_000 }, cart),
    ).toEqual({
      kind: 'promo',
      reason: 'MIN_SUBTOTAL',
      minSubtotalVnd: 50_000,
    });
    expect(mapRefusal('PROMO_CODE_INVALID', { reason: 'NOT_FOUND' }, cart)).toEqual({
      kind: 'promo',
      reason: 'NOT_FOUND',
    });
  });

  it('reads the total limits, with contracts’ minimum as the fallback', () => {
    expect(mapRefusal('ORDER_TOTAL_TOO_LOW', { minimumVnd: 15_000 }, cart)).toEqual({
      kind: 'total',
      side: 'low',
      limitVnd: 15_000,
    });
    expect(mapRefusal('ORDER_TOTAL_TOO_LOW', undefined, cart)).toMatchObject({ limitVnd: 15_000 });
    expect(mapRefusal('ORDER_TOTAL_TOO_HIGH', { maximumVnd: 5_000_000 }, cart)).toEqual({
      kind: 'total',
      side: 'high',
      limitVnd: 5_000_000,
    });
  });

  it('anything else is a generic failure carrying its code', () => {
    expect(mapRefusal('RATE_LIMITED', { retryAfterSeconds: 5 }, cart)).toEqual({
      kind: 'failed',
      code: 'RATE_LIMITED',
    });
    expect(mapRefusal('INTERNAL', undefined, cart)).toEqual({ kind: 'failed', code: 'INTERNAL' });
  });
});
