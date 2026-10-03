import { LOYALTY_EARN_STEP_VND } from '../constants.js';

export interface OrderTotals {
  subtotalVnd: number;
  discountVnd: number;
  totalVnd: number;
}

/** product-overview §6.2. `discountsVnd` is empty until promotions and points land (05a, 16). */
export function computeOrderTotals(
  lineTotalsVnd: readonly number[],
  discountsVnd: readonly number[],
): OrderTotals {
  for (const value of [...lineTotalsVnd, ...discountsVnd]) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`computeOrderTotals: ${value} is not a safe non-negative integer`);
    }
  }
  const subtotalVnd = lineTotalsVnd.reduce((sum, v) => sum + v, 0);
  const discountVnd = discountsVnd.reduce((sum, v) => sum + v, 0);
  return { subtotalVnd, discountVnd, totalVnd: subtotalVnd - discountVnd };
}

/** product-overview §6.6 — 1 point per `LOYALTY_EARN_STEP_VND` paid, rounded down. */
export function pointsEarnable(totalVnd: number): number {
  return Math.floor(totalVnd / LOYALTY_EARN_STEP_VND);
}
