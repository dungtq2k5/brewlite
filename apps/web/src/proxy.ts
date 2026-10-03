import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('bl_at')?.value;
  const refreshToken = request.cookies.get('bl_rt')?.value;

  // 1. Chuyển hướng Guest đến /login nếu truy cập các route yêu cầu đăng nhập (ADR 0029)
  const isProtectedRoute =
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/orders') ||
    pathname.startsWith('/account');

  if (isProtectedRoute && !token && !refreshToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|sw.js).*)'],
};
