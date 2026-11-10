'use client';

import { WifiOff } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { createInstance } from 'i18next';
import { I18nextProvider, useTranslation } from 'react-i18next';
import enCommon from '@/i18n/locales/en/common.json';
import enPwa from '@/i18n/locales/en/pwa.json';
import viCommon from '@/i18n/locales/vi/common.json';
import viPwa from '@/i18n/locales/vi/pwa.json';
import { LOCALE_COOKIE, LOCALE_MAX_AGE_SECONDS } from '@/lib/cookies';
import { resolveLocale } from '@/i18n/locale';
import { LanguageToggle } from './LanguageToggle';
import type { Locale } from '@/i18n/settings';

const resources = {
  en: { common: enCommon, pwa: enPwa },
  vi: { common: viCommon, pwa: viPwa },
};

const cookieLocale = (): Locale =>
  resolveLocale(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`).exec(document.cookie)?.[1]);

/**
 * The offline page (16:2). One static document serves both languages, so the language is
 * read from the `bl_locale` cookie after mount, and switched here without the network
 * (the header's usual switch is a Server Action, which cannot run offline).
 */
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

export function OfflineView() {
  // The prerendered HTML is English; the visitor's cookie takes over on the client.
  const locale = useSyncExternalStore(subscribe, cookieLocale, () => 'en' as Locale);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const i18n = useMemo(() => {
    const instance = createInstance();
    void instance.init({
      lng: locale,
      resources,
      ns: ['common', 'pwa'],
      interpolation: { escapeValue: false },
      initAsync: false,
    });
    return instance;
  }, [locale]);

  const choose = (next: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_MAX_AGE_SECONDS}; samesite=lax`;
    listeners.forEach((notify) => notify());
  };

  return (
    <I18nextProvider i18n={i18n}>
      <OfflineContent locale={locale} onChoose={choose} />
    </I18nextProvider>
  );
}

function OfflineContent({
  locale,
  onChoose,
}: Readonly<{ locale: Locale; onChoose: (l: Locale) => void }>) {
  const { t } = useTranslation(['common', 'pwa']);
  return (
    <>
      <header className="mx-auto flex max-w-5xl items-center px-4 pt-[env(safe-area-inset-top)]">
        <Image
          src="/logo.svg"
          alt={t('common:brand')}
          width={124}
          height={28}
          priority
          unoptimized
          className="max-[379px]:hidden"
        />
        <Image
          src="/symbol.svg"
          alt={t('common:brand')}
          width={28}
          height={28}
          priority
          unoptimized
          className="min-[380px]:hidden"
        />
        <div className="ml-auto">
          <LanguageToggle
            locale={locale}
            onChoose={onChoose}
            groupLabel={t('common:language.label')}
            nameOf={(l) => t(`common:language.name.${l}`)}
            shortOf={(l) => t(`common:language.${l}`)}
          />
        </div>
      </header>
      <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
        <div
          className="bg-secondary text-secondary-content flex w-full items-center gap-4 rounded-box px-6 py-5 text-4xl font-semibold"
          aria-hidden
        >
          #<span className="border-secondary-content/60 h-10 border-l border-dashed" />
          <span className="flex flex-1 justify-around">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="bg-secondary-content h-1.5 w-7 rounded" />
            ))}
          </span>
        </div>
        <WifiOff aria-hidden size={28} />
        <h1 className="text-3xl font-bold">{t('pwa:offline.title')}</h1>
        <p>{t('pwa:offline.body')}</p>
        <button
          type="button"
          className="btn btn-primary w-full"
          onClick={() => window.location.reload()}
        >
          {t('pwa:offline.retry')}
        </button>
      </main>
    </>
  );
}
