'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { setLocale } from '@/actions/locale';
import { SUPPORTED_LOCALES, type Locale } from '@/i18n/settings';

/** EN | VI. The switch re-renders the page on the server; client state (a half-typed form, the cart) stays. */
export function LanguageSwitch() {
  const { t, i18n } = useTranslation('common');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const current = i18n.language as Locale;

  const choose = (locale: Locale) => {
    if (locale === current) return;
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
    });
  };

  return (
    <div
      role="group"
      aria-label={t('language.label')}
      className="bg-base-200 border-base-300 inline-flex items-center rounded-full border"
    >
      {SUPPORTED_LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          aria-label={t(`language.name.${locale}`)}
          aria-pressed={locale === current}
          disabled={pending}
          onClick={() => choose(locale)}
          className="grid min-h-11 min-w-11 place-items-center"
        >
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              locale === current ? 'bg-primary text-primary-content' : 'text-base-content'
            }`}
          >
            {t(`language.${locale}`)}
          </span>
        </button>
      ))}
    </div>
  );
}
