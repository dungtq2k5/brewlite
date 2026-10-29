export type Locale = 'vi' | 'en';

export const LOCALE_COOKIE = 'bl_locale';
export const DEFAULT_LOCALE: Locale = 'vi';

export function normalizeLocale(value: string | null | undefined): Locale {
  return value === 'en' ? 'en' : DEFAULT_LOCALE;
}

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'vi' || value === 'en';
}
