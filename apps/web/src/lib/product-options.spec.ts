import { ProductSize } from '@brewlite/contracts';
import { describe, expect, it } from 'vitest';
import { EMPTY_CART, add, lineKey } from './cart/cart';
import { newLine } from './cart/fixtures';
import { addState, addTotalVnd, sortSizes } from './product-options';

describe('sortSizes', () => {
  it('puts S before M before L', () => {
    expect(sortSizes([{ size: 'L' }, { size: 'S' }, { size: 'M' }]).map((s) => s.size)).toEqual([
      'S',
      'M',
      'L',
    ]);
  });
});

describe('addTotalVnd', () => {
  it('is unit price times quantity — the contracts rule', () => {
    expect(addTotalVnd(45_000, 6_000, [8_000, 12_000], 1)).toBe(71_000);
    expect(addTotalVnd(45_000, 6_000, [8_000, 12_000], 3)).toBe(213_000);
  });
});

describe('addState', () => {
  const full = () => {
    let cart = EMPTY_CART;
    for (let i = 0; i < 20; i++) cart = add(cart, newLine({ productId: `p${i}` }), 1).cart;
    return cart;
  };

  it('is ready on an empty cart', () => {
    expect(addState(false, true, EMPTY_CART, lineKey('p1', ProductSize.S, []))).toBe('ready');
  });
  it('waits for the stored cart to be read', () => {
    expect(addState(false, false, EMPTY_CART, 'x')).toBe('loading');
    expect(addState(true, false, EMPTY_CART, 'x')).toBe('soldOut');
  });
  it('sold out wins', () => {
    expect(addState(true, true, EMPTY_CART, 'x')).toBe('soldOut');
  });
  it('is cartFull for a new line in a full cart, ready for a matching one', () => {
    const cart = full();
    expect(addState(false, true, cart, lineKey('new', 'S', []))).toBe('cartFull');
    expect(addState(false, true, cart, lineKey('p3', 'S', []))).toBe('ready');
  });
  it('is lineFull when the matching line is at 10', () => {
    const cart = add(EMPTY_CART, newLine(), 10).cart;
    expect(addState(false, true, cart, cart.lines[0]!.key)).toBe('lineFull');
  });
});
