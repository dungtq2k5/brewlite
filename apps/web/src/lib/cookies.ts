import { parseServerEnv } from '@/config/env.schema';

/** Cookie names and shared attributes (architecture §4.2, §4.7). */
export const ACCESS_COOKIE = 'bl_at';
export const REFRESH_COOKIE = 'bl_rt';
export const LOCALE_COOKIE = 'bl_locale';
export const LOCALE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export interface SessionTokens {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken?: string;
  refreshTokenExpiresAt?: string;
}

export function cookieSecure(): boolean {
  return parseServerEnv().NODE_ENV === 'production';
}

/** `maxAge` in seconds from an ISO instant; at least 1 so a near-expired token still sets. */
export function maxAgeSeconds(iso: string, nowMs = Date.now()): number {
  return Math.max(1, Math.floor((Date.parse(iso) - nowMs) / 1000));
}
