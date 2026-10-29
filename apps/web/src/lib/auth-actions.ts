'use server';

import {
  authControllerFirebase,
  authControllerLogin,
  authControllerLogout,
  authControllerRegister,
  type SessionResponseDto,
} from '@brewlite/api-client';
import { cookies } from 'next/headers';
import { normalizeLocale } from '@/i18n/locale';
import { actionFailure, type ActionResult } from './action-result';
import { REFRESH_COOKIE, clearSessionCookies, setSessionCookies } from './auth-cookies';
import type { AuthSuccess, LoginInput, RegisterInput } from './auth-types';
import { unwrap } from './api-server';
import { safeNextPath } from './navigation';

function homePathForRole(role: string): string {
  switch (role) {
    case 'STAFF':
      return '/staff';
    case 'ADMIN':
      return '/admin';
    default:
      return '/';
  }
}

function success(session: SessionResponseDto, next: string | undefined): AuthSuccess {
  return {
    redirectTo: safeNextPath(next, homePathForRole(session.user.role)),
    user: {
      id: session.user.id,
      email: session.user.email,
      fullName: session.user.fullName,
      role: session.user.role,
      preferredLocale: normalizeLocale(session.user.preferredLocale),
    },
  };
}

export async function loginAction(input: LoginInput): Promise<ActionResult<AuthSuccess>> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password) {
    return { ok: false, code: 'VALIDATION_FAILED', details: {} };
  }

  try {
    const response = await authControllerLogin({ email, password: input.password });
    const session = unwrap<SessionResponseDto>(response.data);
    await setSessionCookies({
      accessToken: session.accessToken,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      refreshToken: session.refreshToken,
      refreshTokenExpiresAt: session.refreshTokenExpiresAt,
    });
    return { ok: true, data: success(session, input.next) };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function registerAction(input: RegisterInput): Promise<ActionResult<AuthSuccess>> {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  if (!email || !input.password || !fullName) {
    return { ok: false, code: 'VALIDATION_FAILED', details: {} };
  }

  try {
    const response = await authControllerRegister({
      email,
      password: input.password,
      fullName,
      preferredLocale: normalizeLocale(input.preferredLocale),
    });
    const session = unwrap<SessionResponseDto>(response.data);
    await setSessionCookies({
      accessToken: session.accessToken,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      refreshToken: session.refreshToken,
      refreshTokenExpiresAt: session.refreshTokenExpiresAt,
    });
    return { ok: true, data: success(session, input.next) };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function firebaseAction(
  idToken: string,
  next?: string,
): Promise<ActionResult<AuthSuccess>> {
  if (!idToken) return { ok: false, code: 'FIREBASE_TOKEN_INVALID', details: {} };

  try {
    const response = await authControllerFirebase({ idToken });
    const session = unwrap<SessionResponseDto>(response.data);
    await setSessionCookies({
      accessToken: session.accessToken,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      refreshToken: session.refreshToken,
      refreshTokenExpiresAt: session.refreshTokenExpiresAt,
    });
    return { ok: true, data: success(session, next) };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function logoutAction(): Promise<ActionResult<{ redirectTo: string }>> {
  const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value;
  try {
    if (refreshToken) await authControllerLogout({ refreshToken });
  } catch {
    // Clearing the browser session matters more than revoking a token the gateway may already know.
  }
  await clearSessionCookies();
  return { ok: true, data: { redirectTo: '/login' } };
}
