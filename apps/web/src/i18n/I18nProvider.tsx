'use client';

import { useMemo, type ReactNode } from 'react';
import { createInstance, type Resource } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { DEFAULT_LOCALE, NAMESPACES, type Locale } from './settings';

/**
 * Built from the resources the server already loaded — no backend, no async — so the first
 * client render matches the server's HTML. A new locale swaps the instance; children stay
 * mounted, so a half-typed form survives the switch.
 */
export function I18nProvider({
  locale,
  resources,
  children,
}: {
  locale: Locale;
  resources: Resource;
  children: ReactNode;
}) {
  const i18n = useMemo(() => {
    const instance = createInstance();
    void instance.init({
      lng: locale,
      resources,
      fallbackLng: DEFAULT_LOCALE,
      ns: [...NAMESPACES],
      defaultNS: 'common',
      interpolation: { escapeValue: false },
      initAsync: false,
    });
    return instance;
  }, [locale, resources]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
