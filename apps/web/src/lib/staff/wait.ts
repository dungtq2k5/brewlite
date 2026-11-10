import { STAFF_ORDER_WAIT_WARN_MINUTES } from '@brewlite/contracts';

const MINUTE_MS = 60_000;

/** Whole minutes since the order was paid; never negative (a tablet clock a little behind the server's). */
export function waitMinutes(paidAtIso: string, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - new Date(paidAtIso).getTime()) / MINUTE_MS));
}

/** Past this the chip and the card border are the warning style — colour **and** the minutes text. */
export const isLongWait = (minutes: number): boolean => minutes >= STAFF_ORDER_WAIT_WARN_MINUTES;

/** `now` under a minute, `N min` after — as a key and a count for i18next, not as words. */
export function waitLabel(minutes: number): { key: 'now' } | { key: 'min'; count: number } {
  return minutes < 1 ? { key: 'now' } : { key: 'min', count: minutes };
}

/** Milliseconds until the next whole minute of this order's wait, so every chip changes on time. */
export function msToNextWaitMinute(paidAtIso: string, nowMs: number): number {
  const elapsed = nowMs - new Date(paidAtIso).getTime();
  return elapsed < 0 ? MINUTE_MS : MINUTE_MS - (elapsed % MINUTE_MS);
}
