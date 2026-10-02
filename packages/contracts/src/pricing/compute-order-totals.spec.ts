import { describe, expect, it } from 'vitest';
import { computeOrderTotals, pointsEarnable } from './compute-order-totals.js';

describe('computeOrderTotals', () => {
  it('subtotal is the sum of line totals, total equals subtotal with no discounts', () => {
    expect(computeOrderTotals([49_000, 35_000], [])).toEqual({
      subtotalVnd: 84_000,
      discountVnd: 0,
      totalVnd: 84_000,
    });
  });

  it('subtracts the sum of discounts', () => {
    expect(computeOrderTotals([100_000], [15_000])).toEqual({
      subtotalVnd: 100_000,
      discountVnd: 15_000,
      totalVnd: 85_000,
    });
  });

  it('throws on a negative input', () => {
    expect(() => computeOrderTotals([-1], [])).toThrow();
  });
});

describe('pointsEarnable', () => {
  it('is 0 just under one step', () => {
    expect(pointsEarnable(9_999)).toBe(0);
  });

  it('is 1 at exactly one step', () => {
    expect(pointsEarnable(10_000)).toBe(1);
  });

  it('rounds down just under two steps', () => {
    expect(pointsEarnable(19_999)).toBe(1);
  });
});
