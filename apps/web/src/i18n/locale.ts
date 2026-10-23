import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from './settings';

/**
 * `bl_locale` if it holds a supported value, otherwise English. `Accept-Language` is ignored
 * on purpose — English is the default by decision (ADR 0028).
 */
export function resolveLocale(cookieValue: string | undefined | null): Locale {
  return SUPPORTED_LOCALES.find((l) => l === cookieValue) ?? DEFAULT_LOCALE;
}
