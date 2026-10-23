'use client';

import { useTranslation } from 'react-i18next';
import { errorMessage } from '@/i18n/error-message';
import type { Locale } from '@/i18n/settings';

/** `message(code, details)` → the words for an API error, in the current language. */
export function useErrorMessage() {
  const { t, i18n } = useTranslation('errors');
  return (code: string, details?: unknown) =>
    errorMessage(t, i18n.language as Locale, code, details);
}
