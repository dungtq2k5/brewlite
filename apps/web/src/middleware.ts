// Next 16.0.0 on Windows never registers `proxy.ts` in a production build
// (vercel/next.js#85243, fixed by #85443). This file keeps the `middleware.ts`
// name until the workspace upgrades Next; rename it back to `proxy.ts` then.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAccessTokenExpired, isAccessTokenExpiring } from './lib/jwt';

const ACCESS_COOKIE = 'bl_at';
const REFRESH_COOKIE = 'bl_rt';
const GATEWAY_URL = (
  process.env.GATEWAY_URL ||
  process.env.API_URL ||
  'http://127.0.0.1:23100'
).replace(/\/+$/, '');

const PROTECTED_PREFIXES = ['/checkout', '/orders', '/account', '/staff', '/admin'];
const NONCE_HEADER = 'x-nonce';
const IS_DEV = process.env.NODE_ENV !== 'production';
const STRIPE_ORIGINS = 'https://js.stripe.com https://*.stripe.com';
// Stripe's Link wallet lives on link.com; Stripe's CSP guide asks for these
// when Link is enabled in the Dashboard (embedded Checkout can show it).
const LINK_ORIGINS = 'https://link.com https://*.link.com';

function contentSecurityPolicy(nonce: string): string {
  // `'strict-dynamic'` lets Next's nonce'd bootstrap load the Stripe and Firebase
  // chunks it injects; the host list remains for browsers without CSP3 support.
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${STRIPE_ORIGINS} https://apis.google.com https://www.gstatic.com${IS_DEV ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${STRIPE_ORIGINS} ${LINK_ORIGINS} https://firebasestorage.googleapis.com https://*.googleusercontent.com http://localhost:29199`,
    "font-src 'self' data:",
    `connect-src 'self' ${STRIPE_ORIGINS} ${LINK_ORIGINS} https://api.stripe.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com http://127.0.0.1:29099 ws://127.0.0.1:29099${IS_DEV ? ' http://localhost:* ws://localhost:*' : ''}`,
    `frame-src 'self' ${STRIPE_ORIGINS} ${LINK_ORIGINS} https://*.firebaseapp.com https://accounts.google.com https://*.google.com${IS_DEV ? ' http://127.0.0.1:29099' : ''}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self'",
  ].join('; ');
}

function applySecurityHeaders(response: NextResponse, csp: string): NextResponse {
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return response;
}

type RefreshResult =
  | { kind: 'ok'; accessToken: string; expiresAt?: string }
  | { kind: 'invalid' }
  | { kind: 'unavailable' };

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function cookieMaxAge(expiresAt: string | undefined): number {
  if (!expiresAt) return 15 * 60;
  const time = Date.parse(expiresAt);
  if (Number.isNaN(time)) return 15 * 60;
  return Math.max(60, Math.floor((time - Date.now()) / 1000));
}

function setAccessCookie(
  response: NextResponse,
  accessToken: string,
  expiresAt: string | undefined,
): void {
  response.cookies.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: cookieMaxAge(expiresAt),
  });
}

function clearSessionCookies(response: NextResponse): void {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) {
    response.cookies.set(name, '', { path: '/', maxAge: 0 });
  }
}

function clearRefreshCookie(response: NextResponse): void {
  response.cookies.set(REFRESH_COOKIE, '', { path: '/', maxAge: 0 });
}

async function refreshAccessToken(refreshToken: string): Promise<RefreshResult> {
  try {
    const response = await fetch(`${GATEWAY_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
    if (response.status === 401 || response.status === 403) return { kind: 'invalid' };
    if (!response.ok) return { kind: 'unavailable' };

    const body = (await response.json().catch(() => null)) as {
      data?: { accessToken?: unknown; accessTokenExpiresAt?: unknown };
    } | null;
    const accessToken = body?.data?.accessToken;
    if (typeof accessToken !== 'string' || accessToken.length === 0) {
      return { kind: 'unavailable' };
    }
    const expiresAt = body?.data?.accessTokenExpiresAt;
    return {
      kind: 'ok',
      accessToken,
      expiresAt: typeof expiresAt === 'string' ? expiresAt : undefined,
    };
  } catch {
    return { kind: 'unavailable' };
  }
}

function loginRedirect(request: NextRequest): NextResponse {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(NONCE_HEADER, nonce);
  requestHeaders.set('content-security-policy', csp);

  let activeAccessToken = accessToken;
  let refreshResult: RefreshResult | null = null;

  if (refreshToken && (!accessToken || isAccessTokenExpiring(accessToken))) {
    refreshResult = await refreshAccessToken(refreshToken);
    if (refreshResult.kind === 'ok') activeAccessToken = refreshResult.accessToken;
  }

  const hasValidAccess = !!activeAccessToken && !isAccessTokenExpired(activeAccessToken);

  // 1. Guests (and expired sessions) cannot open a protected surface. Role checks live
  // in the server layouts; the gateway is the final authorization boundary.
  if (isProtected(pathname) && !hasValidAccess) {
    const response = loginRedirect(request);
    if (
      !refreshToken ||
      refreshResult?.kind === 'invalid' ||
      (refreshResult === null && accessToken && isAccessTokenExpired(accessToken))
    ) {
      clearSessionCookies(response);
    }
    return applySecurityHeaders(response, csp);
  }

  // 2. Same-origin `/api/v1` calls carry the httpOnly token forward. Browser JS never
  // handles a bearer token, and the gateway still validates every request. The SSE
  // proxy is a Route Handler, not a rewrite, but needs the same refreshed token.
  if (pathname.startsWith('/api/v1') || pathname.startsWith('/api/events/')) {
    const headers = new Headers(requestHeaders);
    if (hasValidAccess && activeAccessToken) {
      headers.set('authorization', `Bearer ${activeAccessToken}`);
    } else {
      headers.delete('authorization');
    }

    const response = NextResponse.next({ request: { headers } });
    if (refreshResult?.kind === 'ok') {
      setAccessCookie(response, refreshResult.accessToken, refreshResult.expiresAt);
    } else if (refreshResult?.kind === 'invalid' && refreshToken) {
      clearRefreshCookie(response);
    }
    return applySecurityHeaders(response, csp);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (refreshResult?.kind === 'ok') {
    setAccessCookie(response, refreshResult.accessToken, refreshResult.expiresAt);
  } else if (refreshResult?.kind === 'invalid' && refreshToken) {
    clearRefreshCookie(response);
  }
  return applySecurityHeaders(response, csp);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|sw.js).*)'],
};
