'use server';

import { cookies } from 'next/headers';
import {
  ApiClientError,
  authControllerLogin,
  authControllerLogout,
} from '@brewlite/api-client';
import { ensureApiClientConfigured } from '@/lib/api-server';

interface SessionEnvelope {
  data?: {
    accessToken?: string;
    refreshToken?: string;
    user?: {
      id: string;
      email: string;
      fullName?: string;
      role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
      preferredLocale?: 'vi' | 'en';
    };
  };
}

export async function loginAction(email: string, password: string) {
  ensureApiClientConfigured();
  const jar = await cookies();

  try {
    const res = await authControllerLogin({ email, password });
    const body = res.data as unknown as SessionEnvelope;
    const session = body.data;

    if (session?.accessToken && session?.refreshToken) {
      jar.set('bl_at', session.accessToken, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 15 * 60,
      });
      jar.set('bl_rt', session.refreshToken, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });
      if (session.user?.preferredLocale) {
        jar.set('bl_locale', session.user.preferredLocale, {
          httpOnly: false,
          sameSite: 'lax',
          path: '/',
          maxAge: 365 * 24 * 60 * 60,
        });
      }
      if (session.user) {
        jar.set(
          'bl_user',
          JSON.stringify({
            id: session.user.id,
            email: session.user.email,
            fullName: session.user.fullName,
            role: session.user.role,
          }),
          {
            httpOnly: false,
            sameSite: 'lax',
            path: '/',
            maxAge: 30 * 24 * 60 * 60,
          },
        );
      }
      return {
        ok: true,
        data: {
          email: session.user?.email ?? email,
          role: session.user?.role ?? 'ADMIN',
        },
      };
    }
  } catch (err) {
    if (err instanceof ApiClientError) {
      return { ok: false, code: err.code, details: err.details };
    }
    return {
      ok: false,
      code: 'GATEWAY_UNREACHABLE',
      details: err instanceof Error ? err.message : 'Cannot connect to API Gateway',
    };
  }

  return { ok: false, code: 'UNKNOWN_ERROR' };
}

export async function logoutAction() {
  ensureApiClientConfigured();
  const jar = await cookies();
  const refreshToken = jar.get('bl_rt')?.value;

  if (refreshToken) {
    try {
      await authControllerLogout({ refreshToken });
    } catch {
      // Bỏ qua lỗi nếu token đã hết hạn
    }
  }

  jar.delete('bl_at');
  jar.delete('bl_rt');
  jar.delete('bl_user');
  jar.delete('bl_session_email');
  return { ok: true };
}