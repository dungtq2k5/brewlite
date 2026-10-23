import type { Locale } from './settings';

const TIME_ZONE = 'Asia/Ho_Chi_Minh';

const intlLocale = (locale: Locale) => (locale === 'vi' ? 'vi-VN' : 'en-US');

/** `₫29,000` in English, `29.000 ₫` in Vietnamese — the currency never changes. */
export function formatVnd(amount: number | string, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

/**
 * `14:30, 21 Oct` / `14:30, 21/10`, always in Vietnam time whatever the viewer's clock says.
 */
export function formatDateTime(iso: string, locale: Locale): string {
  const date = new Date(iso);
  const part = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, ...opts }).format(date);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  const day = part({ day: 'numeric' });
  if (locale === 'vi') {
    return `${time}, ${part({ day: '2-digit' })}/${part({ month: '2-digit' })}`;
  }
  return `${time}, ${day} ${part({ month: 'short' })}`;
}

/** A menu-content pair rendered in the viewer's language (ADR 0031) — never a translation key. */
export function localized(text: { en: string; vi: string }, locale: Locale): string {
  return text[locale];
}
