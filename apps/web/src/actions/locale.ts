'use server';

import { cookies } from 'next/headers';
import { usersControllerUpdate } from '@brewlite/api-client';
import '@/lib/api';
import { type ActionResult, toResult } from '@/lib/action-result';
import { ACCESS_COOKIE, LOCALE_COOKIE, LOCALE_MAX_AGE_SECONDS } from '@/lib/cookies';
import { resolveLocale } from '@/i18n/locale';

/**
 * Sets `bl_locale` and, for a signed-in user, saves it on the account. A failed save never
 * undoes the cookie — the language is already switched on this device.
 */
export async function setLocale(value: string): Promise<ActionResult> {
  const locale = resolveLocale(value);
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale, { path: '/', sameSite: 'lax', maxAge: LOCALE_MAX_AGE_SECONDS });
  if (!jar.get(ACCESS_COOKIE)) return { ok: true, data: undefined };
  const result = await toResult(() => usersControllerUpdate({ preferredLocale: locale }));
  return result.ok ? { ok: true, data: undefined } : result;
}
