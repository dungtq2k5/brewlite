import { z } from 'zod';

/**
 * The shop's calendar: a **business day** is a calendar day in `Asia/Ho_Chi_Minh` (rdm-spec §2.2),
 * never the server's zone. Vietnam has no daylight saving (UTC+7 all year), but the offset is
 * read from the zone by `Intl`, not typed as `+7`. Client-safe — a date picker can use these.
 */
export const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/** A report reads at most this many business days at once (api-endpoints-plan §3.4). */
export const REPORT_MAX_DAYS = 93;

const DAY_MS = 24 * 60 * 60_000;

const parts = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** The wall clock of `instant` in the business zone, as a UTC timestamp (a way to compare and subtract). */
function wallClockAsUtc(instant: Date): number {
  const p = Object.fromEntries(parts.formatToParts(instant).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!);
}

/** `'YYYY-MM-DD'` — the business day an instant falls on. */
export function businessDay(instant: Date): string {
  return new Date(wallClockAsUtc(instant)).toISOString().slice(0, 10);
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date written `YYYY-MM-DD` (2026-02-30 is not one). */
export function isBusinessDay(value: string): boolean {
  if (!DAY_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** The UTC instant at which a business day begins (its 00:00 in the zone). */
function startOfBusinessDay(day: string): Date {
  const asUtc = Date.parse(`${day}T00:00:00Z`);
  // The zone's offset at that moment; looked up twice so a day whose midnight sits across an
  // offset change still lands right (never in Vietnam, but the rule costs one line).
  let instant = asUtc - (wallClockAsUtc(new Date(asUtc)) - asUtc);
  instant = asUtc - (wallClockAsUtc(new Date(instant)) - instant);
  return new Date(instant);
}

const nextDay = (day: string): string =>
  new Date(Date.parse(`${day}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);

/**
 * The UTC instants bounding the days `from`…`to` inclusive: `[from 00:00, to + 1 day 00:00)` in
 * Vietnam time. `end` is exclusive.
 */
export function businessDayRange(from: string, to: string): { start: Date; end: Date } {
  return { start: startOfBusinessDay(from), end: startOfBusinessDay(nextDay(to)) };
}

/** How many business days `from`…`to` span, both included. */
export const businessDayCount = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;

/** Every business day from `from` to `to`, in order. */
export function listBusinessDays(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = nextDay(day)) days.push(day);
  return days;
}

/** `YYYY-MM-DD` that is a real date. */
export const zBusinessDay = z.string().refine(isBusinessDay, { message: 'not a YYYY-MM-DD date' });

/** `from` ≤ `to` and at most `REPORT_MAX_DAYS` days — the report's input (400 VALIDATION_FAILED otherwise). */
export const zBusinessDayRange = z
  .object({ from: zBusinessDay, to: zBusinessDay })
  .strict()
  .refine((r) => r.from <= r.to, { message: 'from is after to', path: ['from'] })
  .refine((r) => businessDayCount(r.from, r.to) <= REPORT_MAX_DAYS, {
    message: `a range is at most ${REPORT_MAX_DAYS} days`,
    path: ['to'],
  });
