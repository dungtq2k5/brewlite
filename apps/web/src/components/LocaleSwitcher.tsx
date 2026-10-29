'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setLocaleAction } from '@/lib/locale-actions';
import type { Locale } from '@/i18n/locale';

export default function LocaleSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale || pending) return;
    try {
      localStorage.setItem('brewlite_lang', next);
    } catch {
      // The cookie is the source of truth; storage is only a legacy mirror.
    }
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  }

  return (
    <span
      className="tag"
      style={{ display: 'inline-flex', gap: 4, padding: '2px 6px', alignItems: 'center' }}
      aria-label="Ngôn ngữ / Language"
    >
      <button
        type="button"
        className="text-link"
        style={{ fontWeight: locale === 'vi' ? 600 : 400, opacity: locale === 'vi' ? 1 : 0.6 }}
        aria-pressed={locale === 'vi'}
        onClick={() => choose('vi')}
      >
        VI
      </button>
      <span aria-hidden="true" style={{ color: 'var(--color-rule)' }}>
        /
      </span>
      <button
        type="button"
        className="text-link"
        style={{ fontWeight: locale === 'en' ? 600 : 400, opacity: locale === 'en' ? 1 : 0.6 }}
        aria-pressed={locale === 'en'}
        onClick={() => choose('en')}
      >
        EN
      </button>
    </span>
  );
}
