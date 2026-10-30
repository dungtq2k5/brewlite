import { describe, expect, it, vi } from 'vitest';
import { EMPTY_CART, add } from './cart';
import { newLine, topping } from './fixtures';
import { createCartStorage, parseCart, type StorageLike } from './storage';

const memory = (): StorageLike & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
};

const cart = add(
  add(EMPTY_CART, newLine({ toppings: [topping('a')] }), 2).cart,
  newLine({ productId: 'p2' }),
  1,
).cart;

describe('parseCart', () => {
  it('round-trips a real cart', () => {
    expect(parseCart(JSON.stringify(cart))).toEqual(cart);
  });

  it.each([
    ['nothing', null],
    ['not JSON', '{nope'],
    ['an old array shape', JSON.stringify([{ productId: 'x', quantity: 2 }])],
    ['another version', JSON.stringify({ v: 2, lines: [] })],
    ['lines that is not a list', JSON.stringify({ v: 1, lines: 'x' })],
  ])('is an empty cart for %s', (_name, raw) => {
    expect(parseCart(raw)).toEqual(EMPTY_CART);
  });

  it('is empty when any line is invalid', () => {
    const bad = JSON.parse(JSON.stringify(cart));
    bad.lines[1].quantity = 11;
    expect(parseCart(JSON.stringify(bad))).toEqual(EMPTY_CART);
    const noName = JSON.parse(JSON.stringify(cart));
    delete noName.lines[0].name.vi;
    expect(parseCart(JSON.stringify(noName))).toEqual(EMPTY_CART);
  });

  it('is empty when a key does not match its line, or keys repeat, or there are 21 lines', () => {
    const wrongKey = JSON.parse(JSON.stringify(cart));
    wrongKey.lines[0].key = 'p1|S|';
    expect(parseCart(JSON.stringify(wrongKey))).toEqual(EMPTY_CART);
    const dup = { v: 1, lines: [cart.lines[0], cart.lines[0]] };
    expect(parseCart(JSON.stringify(dup))).toEqual(EMPTY_CART);
    let big = EMPTY_CART;
    for (let i = 0; i < 20; i++) big = add(big, newLine({ productId: `p${i}` }), 1).cart;
    const tooMany = {
      v: 1,
      lines: [...big.lines, { ...big.lines[0]!, key: 'x|S|', productId: 'x' }],
    };
    expect(parseCart(JSON.stringify(tooMany))).toEqual(EMPTY_CART);
  });
});

describe('createCartStorage', () => {
  it('writes and reads through storage; an empty cart removes the key', () => {
    const storage = memory();
    const store = createCartStorage(() => storage);
    expect(store.write(cart)).toBe(true);
    expect(store.read()).toEqual(cart);
    store.write(EMPTY_CART);
    expect(storage.data.size).toBe(0);
  });

  it('a throwing localStorage means "in memory": read is null, write is false, nothing throws', () => {
    const boom = vi.fn(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    const throwing: StorageLike = { getItem: boom, setItem: boom, removeItem: boom };
    const store = createCartStorage(() => throwing);
    expect(store.read()).toBeNull();
    expect(store.write(cart)).toBe(false);
    const gone = createCartStorage(() => null);
    expect(gone.read()).toBeNull();
    expect(gone.write(cart)).toBe(false);
  });

  it('a storage getter that throws is the same', () => {
    const store = createCartStorage(() => {
      throw new Error('no storage');
    });
    expect(store.read()).toBeNull();
    expect(store.write(cart)).toBe(false);
  });
});
