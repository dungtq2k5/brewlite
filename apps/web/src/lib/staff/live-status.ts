/**
 * What the board's stream is doing, for the top bar (a different part of the tree than the board).
 * A tiny external store: the board writes, `LiveBadge` reads with `useSyncExternalStore`.
 */
export interface LiveStatus {
  /** A board is mounted and following the stream. */
  active: boolean;
  live: boolean;
  reconnecting: boolean;
}

const IDLE: LiveStatus = { active: false, live: false, reconnecting: false };
let current = IDLE;
const listeners = new Set<() => void>();

export const subscribeLive = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getLive = (): LiveStatus => current;
export const getLiveOnServer = (): LiveStatus => IDLE;

export function setLive(next: LiveStatus): void {
  if (
    next.active === current.active &&
    next.live === current.live &&
    next.reconnecting === current.reconnecting
  ) {
    return;
  }
  current = next;
  listeners.forEach((l) => l());
}

export const clearLive = () => setLive(IDLE);
