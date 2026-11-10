import type { QuoteResponseDto } from '@brewlite/api-client';

/** What the customer chose: no points, all they can, or a number — kept across re-quotes. */
export type PointsChoice = { mode: 'off' } | { mode: 'all' } | { mode: 'some'; n: number };

/**
 * `pointsToRedeem` for a choice. *All* sends the whole balance and lets the server clip it to
 * the cap, so *all* always means *all I can*; the screen computes no cap of its own.
 */
export function pointsToRedeemFor(choice: PointsChoice, balance: number): number | undefined {
  if (choice.mode === 'off') return undefined;
  const n = choice.mode === 'all' ? balance : choice.n;
  return n >= 1 ? Math.floor(n) : undefined;
}

export type CapLine = 'BALANCE' | 'PERCENT' | 'FLOOR';

/**
 * The cap line shows only when it bites: the quote applied the cap and the customer asked for at
 * least that many. Worded by the server's reason (D06 decision 2).
 */
export function capLineFor(
  quote: Pick<
    QuoteResponseDto,
    'pointsRedeemed' | 'pointsRedeemable' | 'pointsCapReason' | 'pointsBalance'
  >,
  choice: PointsChoice,
): CapLine | null {
  const asked = pointsToRedeemFor(choice, quote.pointsBalance);
  if (asked === undefined || quote.pointsRedeemable === 0) return null;
  if (quote.pointsRedeemed !== quote.pointsRedeemable || asked < quote.pointsRedeemable)
    return null;
  return quote.pointsCapReason;
}

/** After `POINTS_INSUFFICIENT`: back to *all* against the new balance, or off when it is gone. */
export const choiceAfterBalanceChange = (balance: number): PointsChoice =>
  balance > 0 ? { mode: 'all' } : { mode: 'off' };
