import {
  LOYALTY_MAX_REDEEM_PERCENT,
  LOYALTY_POINT_VALUE_VND,
  MIN_PAYABLE_VND,
  PointsCapReason,
} from '@brewlite/contracts';

export interface PointsCap {
  /** The most points this order can take. */
  cap: number;
  /** The first limit, in BALANCE → PERCENT → FLOOR order, that sets `cap`. */
  reason: PointsCapReason;
}

/**
 * ADR 0035 — the promotion applies first; points second, in whole points, capped by the
 * smallest of the balance, `LOYALTY_MAX_REDEEM_PERCENT` of the **subtotal**, and what keeps
 * the total at or above `MIN_PAYABLE_VND`.
 */
export function pointsCap(input: {
  balance: number;
  subtotalVnd: number;
  promoDiscountVnd: number;
}): PointsCap {
  const byBalance = Math.max(0, input.balance);
  const byPercent = Math.floor(
    (input.subtotalVnd * LOYALTY_MAX_REDEEM_PERCENT) / 100 / LOYALTY_POINT_VALUE_VND,
  );
  const byFloor = Math.max(
    0,
    Math.floor(
      (input.subtotalVnd - input.promoDiscountVnd - MIN_PAYABLE_VND) / LOYALTY_POINT_VALUE_VND,
    ),
  );
  const cap = Math.min(byBalance, byPercent, byFloor);
  const reason =
    cap === byBalance
      ? PointsCapReason.BALANCE
      : cap === byPercent
        ? PointsCapReason.PERCENT
        : PointsCapReason.FLOOR;
  return { cap, reason };
}

/** What a request for `requested` points actually spends: clipped to the cap, absent = none. */
export const pointsApplied = (requested: number | undefined, cap: number): number =>
  Math.max(0, Math.min(requested ?? 0, cap));
