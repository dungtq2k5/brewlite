import { describe, expect, it } from 'vitest';
import { computeUnitPrice } from './compute-unit-price.js';

describe('computeUnitPrice', () => {
  it('sums base, size delta and toppings — the §6.2 example', () => {
    expect(computeUnitPrice(29_000, 6_000, [8_000, 6_000])).toBe(49_000);
  });

  it('with no toppings', () => {
    expect(computeUnitPrice(29_000, 0, [])).toBe(29_000);
  });

  it('with three toppings', () => {
    expect(computeUnitPrice(35_000, 10_000, [8_000, 6_000, 12_000])).toBe(71_000);
  });

  it('throws on a float input', () => {
    expect(() => computeUnitPrice(29_000.5, 0, [])).toThrow();
  });

  it('throws on a negative input', () => {
    expect(() => computeUnitPrice(29_000, -1, [])).toThrow();
  });
});
