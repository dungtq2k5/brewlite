'use client';

import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import {
  formatDateTime,
  formatVnd,
  localized,
  type LocalizedText,
  type SupportedLocale,
} from './format';

interface LocaleContextValue {
  locale: SupportedLocale;
  setLocale: (next: SupportedLocale) => void;
  tx: (vi: string, en: string) => string;
  tText: (text: LocalizedText | null | undefined) => string;
  money: (amountVnd: number) => string;
  dateTime: (iso: string | Date) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>('vi');

  function setLocale(next: SupportedLocale) {
    setLocaleState(next);
    document.cookie = `bl_locale=${next}; path=/; max-age=31536000; SameSite=Lax`;
  }

  function tx(vi: string, en: string): string {
    return locale === 'vi' ? vi : en;
  }

  function tText(text: LocalizedText | null | undefined): string {
    return localized(text, locale);
  }

  function money(amountVnd: number): string {
    return formatVnd(amountVnd, locale);
  }

  function dateTime(iso: string | Date): string {
    return formatDateTime(iso, locale);
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, tx, tText, money, dateTime }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used inside LocaleProvider');
  }
  return ctx;
}