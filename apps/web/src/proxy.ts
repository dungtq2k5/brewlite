import { NextResponse, type NextRequest } from 'next/server';
import { parsePublicEnv, parseServerEnv } from '@/config/env.schema';
import { buildCsp, newNonce } from '@/lib/csp';
import { clientIp } from '@/lib/client-ip';
import { ACCESS_COOKIE, REFRESH_COOKIE, cookieSecure, maxAgeSeconds } from '@/lib/cookies';
import { decodeJwt, secondsUntilExpiry } from '@/lib/jwt';
import { refreshAccessToken } from '@/lib/refresh';
import { needsAccount, roleRedirect } from '@/lib/route-access';

const REFRESH_WITHIN_SECONDS = 30;

/** The `cookie` header the page will see, with `bl_at` replaced (or both dropped). */
function forwardedCookieHeader(request: NextRequest, accessToken: string | null): string {
  return request.cookies
    .getAll()
    .filter((c) => c.name !== ACCESS_COOKIE && !(accessToken === null && c.name === REFRESH_COOKIE))
    .concat(accessToken ? [{ name: ACCESS_COOKIE, value: accessToken }] : [])
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}

/**
 * In this order (architecture §4.2): refresh the access token, send guests to sign in, gate
 * `/staff` and `/admin`, then set the Content-Security-Policy. The role check is a hint — the layouts re-check, the gateway decides.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  let accessToken = request.cookies.get(ACCESS_COOKIE)?.value ?? null;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  let refreshed: { token: string; expiresAt: string } | null = null;
  let cleared = false;

  // 1. Refresh.
  if (refreshToken && (!accessToken || secondsUntilExpiry(accessToken) < REFRESH_WITHIN_SECONDS)) {
    const outcome = await refreshAccessToken(
      parseServerEnv().API_URL,
      refreshToken,
      clientIp(request.headers),
    );
    if (outcome.kind === 'refreshed') {
      accessToken = outcome.accessToken;
      refreshed = { token: outcome.accessToken, expiresAt: outcome.accessTokenExpiresAt };
    } else if (outcome.kind === 'expired') {
      accessToken = null;
      cleared = true;
    }
  }

  const finish = (response: NextResponse) => {
    const attrs = { httpOnly: true, sameSite: 'lax' as const, secure: cookieSecure(), path: '/' };
    if (refreshed) {
      response.cookies.set(ACCESS_COOKIE, refreshed.token, {
        ...attrs,
        maxAge: maxAgeSeconds(refreshed.expiresAt),
      });
    }
    if (cleared) {
      response.cookies.delete(ACCESS_COOKIE);
      response.cookies.delete(REFRESH_COOKIE);
    }
    return response;
  };

  // 2. Guests to sign in.
  if (!accessToken && needsAccount(pathname)) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', pathname + search);
    return finish(NextResponse.redirect(url));
  }

  // 3. Roles.
  const redirect = accessToken ? roleRedirect(pathname, decodeJwt(accessToken)?.role) : null;
  const guestOnPrivate = !accessToken && roleRedirect(pathname, undefined);
  const target = redirect ?? guestOnPrivate;
  if (target) return finish(NextResponse.redirect(new URL(target, request.url)));

  // 4. The Content-Security-Policy. Next reads the nonce from the *request's* header while it
  // renders, so the policy goes on the forwarded headers as well as on the response. Redirects
  // above carry none: they have no body to protect.
  const requestHeaders = new Headers(request.headers);
  if (refreshed || cleared) {
    // Forward the new token so this very render is signed in.
    requestHeaders.set('cookie', forwardedCookieHeader(request, refreshed?.token ?? null));
  }
  const nonce = newNonce();
  const policy = contentSecurityPolicy(nonce);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', policy);
  const response = finish(NextResponse.next({ request: { headers: requestHeaders } }));
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

function contentSecurityPolicy(nonce: string): string {
  const server = parseServerEnv();
  const browser = parsePublicEnv();
  return buildCsp({
    nonce,
    dev: server.NODE_ENV === 'development',
    firebaseAuthDomain: browser.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    authEmulatorUrl: browser.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL,
    storageBaseUrl: server.STORAGE_PUBLIC_BASE_URL,
  });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon|apple-touch-icon|icon-|logo|symbol|og-image|sw\\.js|manifest\\.webmanifest|offline).*)',
  ],
};
