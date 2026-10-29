import 'server-only';
import { configureApiClient, usersControllerGet, type MeResponseDto } from '@brewlite/api-client';
import { cookies, headers } from 'next/headers';
import { ACCESS_COOKIE } from './auth-cookies';

const GATEWAY_URL = (
  process.env.GATEWAY_URL ||
  process.env.API_URL ||
  'http://127.0.0.1:23100'
).replace(/\/+$/, '');

configureApiClient({
  baseUrl: `${GATEWAY_URL}/api/v1`,
  getRequestHeaders: async () => {
    const result: Record<string, string> = {};
    const token = (await cookies()).get(ACCESS_COOKIE)?.value;
    if (token) result.Authorization = `Bearer ${token}`;

    const incoming = await headers();
    const requestId = incoming.get('x-request-id');
    result['X-Request-Id'] = requestId ?? crypto.randomUUID();
    const forwardedFor = incoming.get('x-forwarded-for');
    if (forwardedFor) result['X-Forwarded-For'] = forwardedFor;
    return result;
  },
});

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Every documented success body is `{ data, meta? }`; generated calls leave it whole. */
export function unwrap<T>(body: unknown): T {
  if (!isRecord(body) || !('data' in body) || body.data === undefined) {
    throw new Error('The gateway returned an unexpected response envelope');
  }
  return body.data as T;
}

/** Reads a list body without trusting the generated union's error branch. */
export function readPage<T>(body: unknown): {
  rows: T[];
  total: number | null;
  nextCursor: string | null;
} {
  if (!isRecord(body)) return { rows: [], total: null, nextCursor: null };
  const rows = Array.isArray(body.data) ? (body.data as T[]) : [];
  const meta = isRecord(body.meta) ? body.meta : null;
  const total = meta && typeof meta.total === 'number' ? meta.total : null;
  const nextCursor =
    meta && typeof meta.nextCursor === 'string' && meta.nextCursor.length > 0
      ? meta.nextCursor
      : null;
  return { rows, total, nextCursor };
}

export function apiErrorCode(error: unknown): string | null {
  return isRecord(error) && typeof error.code === 'string' ? error.code : null;
}

export function isUnauthenticated(error: unknown): boolean {
  if (!isRecord(error)) return false;
  return (
    error.status === 401 || error.code === 'UNAUTHENTICATED' || error.code === 'INVALID_CREDENTIALS'
  );
}

/** `/users/me` is the authoritative role and permission source for the web server. */
export async function fetchMe(): Promise<MeResponseDto> {
  const response = await usersControllerGet();
  return unwrap<MeResponseDto>(response.data);
}
