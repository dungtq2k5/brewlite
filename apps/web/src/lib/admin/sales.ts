export interface Day {
  day: string;
  orders: number;
  revenueVnd: number;
}

/** Revenue ÷ orders, rounded to whole ₫; `null` when there are no orders (shown as *—*). */
export const averageOrder = (revenueVnd: number, orders: number): number | null =>
  orders === 0 ? null : Math.round(revenueVnd / orders);

/** The day with the most revenue (the earlier one on a tie); `null` when nothing was sold. */
export function bestDay(days: readonly Day[]): Day | null {
  let best: Day | null = null;
  for (const d of days) if (d.revenueVnd > (best?.revenueVnd ?? 0)) best = d;
  return best;
}

export const totals = (days: readonly Day[]) => ({
  orders: days.reduce((sum, d) => sum + d.orders, 0),
  revenueVnd: days.reduce((sum, d) => sum + d.revenueVnd, 0),
});

/** Each day's bar height as a share of the busiest day, 0–1 (all zero when nothing was sold). */
export function barShares(days: readonly Day[]): number[] {
  const max = Math.max(0, ...days.map((d) => d.revenueVnd));
  return days.map((d) => (max === 0 ? 0 : d.revenueVnd / max));
}
