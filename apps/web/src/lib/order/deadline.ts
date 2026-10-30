const ZONE = 'Asia/Ho_Chi_Minh';
const MINUTE_MS = 60_000;
/** Under this many minutes (of real time left) the deadline turns into a warning. */
export const WARNING_MINUTES = 3;
/** The one polite announcement is made when this many minutes are left. */
export const ANNOUNCE_AT_MINUTES = 2;

export type DeadlineView =
  | { state: 'counting' | 'warning'; time: string; minutes: number }
  | { state: 'passed'; time: string };

/** `14:35` in Vietnam time. */
export const clockTime = (iso: string | Date): string =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));

/**
 * What the *Pay by …* line says at `nowMs`. Minutes round **up** (a minute and a bit left is still
 * "2 min"); the client clock only decides the wording — the server decides the order.
 */
export function deadlineView(expiresAtIso: string, nowMs: number): DeadlineView {
  const expires = new Date(expiresAtIso).getTime();
  const time = clockTime(expiresAtIso);
  const left = expires - nowMs;
  if (left <= 0) return { state: 'passed', time };
  const minutes = Math.ceil(left / MINUTE_MS);
  return { state: left < WARNING_MINUTES * MINUTE_MS ? 'warning' : 'counting', time, minutes };
}

/** Milliseconds until the next whole minute of the countdown, so the label flips on time. */
export function msToNextMinute(expiresAtIso: string, nowMs: number): number {
  const left = new Date(expiresAtIso).getTime() - nowMs;
  if (left <= 0) return 0;
  return left % MINUTE_MS || MINUTE_MS;
}
