import { REPORT_MAX_DAYS, businessDayCount, isBusinessDay } from '@brewlite/contracts';

/** The chips of the sales range (`today` … `month`) and of a staff member's counter activity (`thisWeek` …). */
export type RangePreset =
  'today' | '7d' | '30d' | 'month' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'custom';

/** `day` moved by `n` calendar days — pure date arithmetic on `YYYY-MM-DD`, no zone involved. */
export function shiftDay(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** The Monday of `day`'s week (weeks start on Monday in Vietnam). */
export function weekStart(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return shiftDay(day, -((weekday + 6) % 7));
}

const monthStart = (day: string) => `${day.slice(0, 8)}01`;

/** `from`…`to` for a preset, given today's business day. `custom` uses what was typed. */
export function resolveRange(
  preset: RangePreset,
  today: string,
  custom?: { from: string; to: string },
): { from: string; to: string } {
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case '7d':
      return { from: shiftDay(today, -6), to: today };
    case '30d':
      return { from: shiftDay(today, -29), to: today };
    case 'month':
    case 'thisMonth':
      return { from: monthStart(today), to: today };
    case 'thisWeek':
      return { from: weekStart(today), to: today };
    case 'lastWeek': {
      const start = shiftDay(weekStart(today), -7);
      return { from: start, to: shiftDay(start, 6) };
    }
    case 'custom':
      return custom ?? { from: today, to: today };
  }
}

export type RangeCheck =
  | { ok: true; days: number }
  | { ok: false; reason: 'invalid' }
  | { ok: false; reason: 'tooLong'; days: number };

/** A custom range is sent only when both ends are real days, ordered, and at most 93 days long. */
export function checkRange(from: string, to: string): RangeCheck {
  if (!isBusinessDay(from) || !isBusinessDay(to) || from > to)
    return { ok: false, reason: 'invalid' };
  const days = businessDayCount(from, to);
  return days > REPORT_MAX_DAYS ? { ok: false, reason: 'tooLong', days } : { ok: true, days };
}
