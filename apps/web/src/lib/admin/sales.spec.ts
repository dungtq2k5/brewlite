import { describe, expect, it } from 'vitest';
import { averageOrder, barShares, bestDay, totals } from './sales';

const days = [
  { day: '2026-11-01', orders: 2, revenueVnd: 100_000 },
  { day: '2026-11-02', orders: 0, revenueVnd: 0 },
  { day: '2026-11-03', orders: 5, revenueVnd: 250_000 },
  { day: '2026-11-04', orders: 5, revenueVnd: 250_000 },
];

describe('sales', () => {
  it('averages, with no average for no orders', () => {
    expect(averageOrder(250_000, 3)).toBe(83_333);
    expect(averageOrder(0, 0)).toBeNull();
  });
  it('picks the best day, the earlier one on a tie, none when empty', () => {
    expect(bestDay(days)?.day).toBe('2026-11-03');
    expect(bestDay([{ day: '2026-11-01', orders: 0, revenueVnd: 0 }])).toBeNull();
  });
  it('totals and bar shares (zero days are zero)', () => {
    expect(totals(days)).toEqual({ orders: 12, revenueVnd: 600_000 });
    expect(barShares(days)).toEqual([0.4, 0, 1, 1]);
    expect(barShares([{ day: 'x', orders: 0, revenueVnd: 0 }])).toEqual([0]);
  });
});
