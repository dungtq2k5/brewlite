import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { env } from '@/config/env.schema';

export async function proxy(request: NextRequest) {
  const accessToken = request.cookies.get('bl_at')?.value;
  const refreshToken = request.cookies.get('bl_rt')?.value;

  const userCookie = request.cookies.get('bl_user')?.value;
  let userRole: string | undefined;
  if (userCookie) {
    try {
      userRole = (JSON.parse(userCookie) as { role?: string })?.role;
    } catch {
      // ignore
    }
  }

  // Chặn STAFF truy cập vào /admin để tránh gặp lỗi 403
  if (userRole === 'STAFF' && request.nextUrl.pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/staff/orders', request.url));
  }

  if (accessToken) {
    return NextResponse.next();
  }

  // Nếu hết hạn bl_at nhưng còn bl_rt -> gọi /auth/refresh
  if (refreshToken) {
    try {
      const refreshRes = await fetch(`${env.API_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': crypto.randomUUID(),
        },
        body: JSON.stringify({ refreshToken }),
        cache: 'no-store',
      });

      if (refreshRes.ok) {
        const payload = (await refreshRes.json()) as {
          data?: { accessToken?: string; refreshToken?: string };
        };
        const nextAt = payload.data?.accessToken;
        const nextRt = payload.data?.refreshToken;

        if (nextAt) {
          const reqHeaders = new Headers(request.headers);
          const existingCookies = reqHeaders.get('cookie') || '';
          const cookieMap = new Map<string, string>();
          existingCookies.split(';').forEach((c) => {
            const [k, ...v] = c.trim().split('=');
            if (k) cookieMap.set(k, v.join('='));
          });
          cookieMap.set('bl_at', nextAt);
          if (nextRt) cookieMap.set('bl_rt', nextRt);
          const serialized = Array.from(cookieMap.entries())
            .map(([k, v]) => `${k}=${v}`)
            .join('; ');
          reqHeaders.set('cookie', serialized);

          const response = NextResponse.next({
            request: {
              headers: reqHeaders,
            },
          });
          response.cookies.set('bl_at', nextAt, {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            maxAge: 15 * 60,
          });
          if (nextRt) {
            response.cookies.set('bl_rt', nextRt, {
              httpOnly: true,
              sameSite: 'lax',
              path: '/',
              maxAge: 30 * 24 * 60 * 60,
            });
          }
          return response;
        }
      }
    } catch {
      // Nếu lỗi kết nối khi refresh thì chuyển về /login
    }
  }

  // Chưa đăng nhập hoặc refresh thất bại -> chuyển hướng về /login
  const loginUrl = new URL('/login', request.url);
  const redirectRes = NextResponse.redirect(loginUrl);
  redirectRes.cookies.delete('bl_at');
  redirectRes.cookies.delete('bl_rt');
  return redirectRes;
}

export const config = {
  matcher: ['/admin/:path*', '/staff/:path*'],
};