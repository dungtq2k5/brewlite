'use server';

import { redirect } from 'next/navigation';
import {
  authControllerFirebase,
  authControllerLogin,
  authControllerLogout,
  authControllerRegister,
} from '@brewlite/api-client';
import '@/lib/api';
import { toResult, type ActionResult } from '@/lib/action-result';
import { REFRESH_COOKIE } from '@/lib/cookies';
import { safeNextPath } from '@/lib/safe-next-path';
import { clearSession, setSession, type Session } from '@/lib/session';
import { validateLogin, validateRegister, type FieldErrors } from '@/lib/validate-auth';
import { getLocale } from '@/i18n/server';
import { cookies } from 'next/headers';

export interface AuthFormState {
  ok?: false;
  code?: string;
  details?: unknown;
  fieldErrors?: FieldErrors;
  /** Echoed back so the form keeps what was typed — never the password. */
  values?: { email?: string; fullName?: string };
}

const str = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
};

function failure(
  result: Extract<ActionResult<unknown>, { ok: false }>,
  values: AuthFormState['values'],
) {
  return { ok: false as const, code: result.code, details: result.details, values };
}

export async function signIn(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const email = str(form, 'email');
  const password = str(form, 'password');
  const next = safeNextPath(str(form, 'next'));
  const values = { email };

  const fieldErrors = validateLogin({ email, password });
  if (fieldErrors) return { ok: false, fieldErrors, values };

  const result = await toResult(() => authControllerLogin({ email, password }));
  if (!result.ok) return failure(result, values);
  const response = result.data;
  if (response.status !== 200 || !response.data.data)
    return { ok: false, code: 'INTERNAL', values };
  await setSession(response.data.data as Session);
  redirect(next);
}

export async function signUp(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const email = str(form, 'email');
  const password = str(form, 'password');
  const fullName = str(form, 'fullName');
  const next = safeNextPath(str(form, 'next'));
  const values = { email, fullName };

  const fieldErrors = validateRegister({ email, password, fullName });
  if (fieldErrors) return { ok: false, fieldErrors, values };

  const preferredLocale = await getLocale();
  const result = await toResult(() =>
    authControllerRegister({ email, password, fullName, preferredLocale }),
  );
  if (!result.ok) return failure(result, values);
  const response = result.data;
  if (response.status !== 201 || !response.data.data)
    return { ok: false, code: 'INTERNAL', values };
  await setSession(response.data.data as Session);
  redirect(next);
}

/** Google (and later Apple): the Firebase ID token proves the sign-in, BrewLite issues the session. */
export async function signInWithFirebase(
  idToken: string,
  nextPath: string,
): Promise<{ code: string; details?: unknown }> {
  const result = await toResult(() => authControllerFirebase({ idToken }));
  if (!result.ok) return { code: result.code, details: result.details };
  const response = result.data;
  // The gateway answers 201 for a new account and 200 for a returning one, though its OpenAPI
  // document lists only 200 (reported) — any 2xx with a session is a sign-in.
  const session = (response.data as { data?: Session }).data;
  if (!session) return { code: 'INTERNAL' };
  await setSession(session as Session);
  redirect(safeNextPath(nextPath));
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    // Revoking is best-effort: the cookies are cleared either way.
    await toResult(() => authControllerLogout({ refreshToken }));
  }
  await clearSession();
  redirect('/');
}
