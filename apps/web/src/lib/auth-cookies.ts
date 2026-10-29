import 'server-only';
import { cookies } from 'next/headers';

export const ACCESS_COOKIE = 'bl_at';
export const REFRESH_COOKIE = 'bl_rt';

const ACCESS_FALLBACK_SECONDS = 15 * 60;
const REFRESH_FALLBACK_SECONDS = 30 * 24 * 60 * 60;

function secondsUntil(iso: string | undefined, fallback: number): number {
  if (!iso) return fallback;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return fallback;
  return Math.max(60, Math.floor((time - Date.now()) / 1000));
}

export interface SessionTokens {
  accessToken: string;
  accessTokenExpiresAt?: string;
  refreshToken: string;
  refreshTokenExpiresAt?: string;
}

/** Access and refresh tokens live in httpOnly cookies; browser JS never sees them. */
export async function setSessionCookies(tokens: SessionTokens): Promise<void> {
  const store = await cookies();
  const secure = process.env.NODE_ENV === 'production';

  store.set(ACCESS_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: secondsUntil(tokens.accessTokenExpiresAt, ACCESS_FALLBACK_SECONDS),
  });
  store.set(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: secondsUntil(tokens.refreshTokenExpiresAt, REFRESH_FALLBACK_SECONDS),
  });
}

export async function setAccessCookie(accessToken: string, expiresAt?: string): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: secondsUntil(expiresAt, ACCESS_FALLBACK_SECONDS),
  });
}

export async function clearSessionCookies(): Promise<void> {
  const store = await cookies();
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) {
    store.set(name, '', { path: '/', maxAge: 0 });
  }
}
