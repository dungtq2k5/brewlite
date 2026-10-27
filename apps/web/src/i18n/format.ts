export interface LocalizedText {
  en: string;
  vi: string;
}
export type SupportedLocale = 'en' | 'vi';

export function formatVnd(amountVnd: number, locale: SupportedLocale = 'vi'): string {
  const tag = locale === 'vi' ? 'vi-VN' : 'en-US';
  return new Intl.NumberFormat(tag, {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amountVnd);
}

export function formatDateTime(iso: string | Date, locale: SupportedLocale = 'vi'): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  const tag = locale === 'vi' ? 'vi-VN' : 'en-US';
  return new Intl.DateTimeFormat(tag, {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function localized(
  text: LocalizedText | null | undefined,
  locale: SupportedLocale = 'vi',
): string {
  if (!text) return '';
  return text[locale] || text.en || '';
}