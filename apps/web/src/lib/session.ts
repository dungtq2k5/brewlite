import 'server-only';
import { cookies } from 'next/headers';
import {
  ACCESS_COOKIE,
  LOCALE_COOKIE,
  LOCALE_MAX_AGE_SECONDS,
  REFRESH_COOKIE,
  cookieSecure,
  maxAgeSeconds,
} from './cookies';

export interface Session {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: { preferredLocale: string };
}

const base = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: cookieSecure(),
  path: '/',
});

/**
 * The only writers of the session cookies, called from Server Actions (and the refresh in
 * `proxy.ts`) — never from a Server Component, where setting a cookie silently does nothing.
 */
export async function setSession(session: Session): Promise<void> {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, session.accessToken, {
    ...base(),
    maxAge: maxAgeSeconds(session.accessTokenExpiresAt),
  });
  jar.set(REFRESH_COOKIE, session.refreshToken, {
    ...base(),
    maxAge: maxAgeSeconds(session.refreshTokenExpiresAt),
  });
  // The account's language follows the customer to a new device (architecture §4.7).
  jar.set(LOCALE_COOKIE, session.user.preferredLocale, {
    path: '/',
    sameSite: 'lax',
    maxAge: LOCALE_MAX_AGE_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

export async function hasSession(): Promise<boolean> {
  return Boolean((await cookies()).get(ACCESS_COOKIE));
}
