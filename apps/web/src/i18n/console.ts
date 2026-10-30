import type { Locale } from './locale';

export interface ConsoleCopy {
  locale: Locale;
  isVi: boolean;
  t: (vi: string, en: string) => string;
}

/** Server-safe copy helper for the admin/staff shells and record pages. */
export function consoleCopy(locale: Locale): ConsoleCopy {
  const isVi = locale === 'vi';
  return { locale, isVi, t: (vi: string, en: string) => (isVi ? vi : en) };
}
