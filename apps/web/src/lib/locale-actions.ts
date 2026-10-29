'use server';

import { cookies } from 'next/headers';
import { isLocale, LOCALE_COOKIE, type Locale } from '@/i18n/locale';
import type { ActionResult } from './action-result';

export async function setLocaleAction(locale: string): Promise<ActionResult<{ locale: Locale }>> {
  if (!isLocale(locale)) return { ok: false, code: 'VALIDATION_FAILED', details: {} };

  (await cookies()).set(LOCALE_COOKIE, locale, {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return { ok: true, data: { locale } };
}
