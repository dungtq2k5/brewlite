import { businessDay } from '@brewlite/contracts';
import type { Locale } from '@/i18n/settings';

const ZONE = 'Asia/Ho_Chi_Minh';
const DAY_MS = 24 * 60 * 60_000;

/** *Today*, *Yesterday* in the viewer's language, from `Intl` — no word typed twice. */
function relativeDay(offset: 0 | -1, locale: Locale): string {
  const text = new Intl.RelativeTimeFormat(locale === 'vi' ? 'vi-VN' : 'en', {
    numeric: 'auto',
  }).format(offset, 'day');
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

/**
 * *Today, 14:20* · *Yesterday, 08:12* · *21 Oct, 17:45* (vi: *Hôm nay, 14:20* · *Hôm qua, 08:12* ·
 * *21/10, 17:45*). "Today" is the Vietnam business day, not the viewer's clock or UTC; a date from
 * another year adds the year. `now` is a parameter so the midnight boundaries can be tested.
 */
export function formatOrderDate(iso: string, locale: Locale, now: Date = new Date()): string {
  const at = new Date(iso);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(at);

  const day = businessDay(at);
  if (day === businessDay(now)) return `${relativeDay(0, locale)}, ${time}`;
  if (day === businessDay(new Date(now.getTime() - DAY_MS))) {
    return `${relativeDay(-1, locale)}, ${time}`;
  }

  const [year, month, dayOfMonth] = day.split('-').map(Number) as [number, number, number];
  const sameYear = year === Number(businessDay(now).slice(0, 4));
  const monthName = new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, month: 'short' }).format(at);
  const date =
    locale === 'vi'
      ? `${String(dayOfMonth).padStart(2, '0')}/${String(month).padStart(2, '0')}${sameYear ? '' : `/${year}`}`
      : `${dayOfMonth} ${monthName}${sameYear ? '' : ` ${year}`}`;
  return `${date}, ${time}`;
}
