'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { consoleCopy, type ConsoleCopy } from './console';
import type { Locale } from './locale';

const ConsoleLocaleContext = createContext<Locale>('vi');

/** The admin/staff shell publishes the cookie locale to every client page below it. */
export function ConsoleLocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return <ConsoleLocaleContext.Provider value={locale}>{children}</ConsoleLocaleContext.Provider>;
}

export function useConsoleLocale(): Locale {
  return useContext(ConsoleLocaleContext);
}

export function useConsoleCopy(): ConsoleCopy {
  const locale = useConsoleLocale();
  return useMemo(() => consoleCopy(locale), [locale]);
}
