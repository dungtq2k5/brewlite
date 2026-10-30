'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { setLocale } from '@/actions/locale';
import type { Locale } from '@/i18n/settings';
import { LanguageToggle } from './LanguageToggle';

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
    <LanguageToggle
      locale={current}
      onChoose={choose}
      disabled={pending}
      groupLabel={t('language.label')}
      nameOf={(l) => t(`language.name.${l}`)}
      shortOf={(l) => t(`language.${l}`)}
    />
  );
}
