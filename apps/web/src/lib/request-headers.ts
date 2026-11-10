import 'server-only';
import { cookies, headers } from 'next/headers';
import { newId } from '@brewlite/contracts';
import { ACCESS_COOKIE } from './cookies';
import { clientIp } from './client-ip';

/**
 * What every call from the web server to the gateway carries: the bearer token from the cookie,
 * the request id, and the visitor's address (ADR 0033). The generated client takes it through
 * `configureApiClient`; the few hand-written fetches (the SSE pass-through, `fake-confirm`) take
 * it directly so they never differ.
 */
export async function requestHeaders(): Promise<Record<string, string>> {
  const jar = await cookies();
  const incoming = await headers();
  const token = jar.get(ACCESS_COOKIE)?.value;
  const ip = clientIp(incoming);
  return {
    ...(token && { Authorization: `Bearer ${token}` }),
    'X-Request-Id': incoming.get('x-request-id') ?? newId(),
    ...(ip && { 'X-Forwarded-For': ip }),
  };
}
