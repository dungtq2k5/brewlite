import 'server-only';
import { cookies, headers } from 'next/headers';
import { configureApiClient } from '@brewlite/api-client';
import { newId } from '@brewlite/contracts';
import { parseServerEnv } from '@/config/env.schema';
import { ACCESS_COOKIE } from './cookies';
import { clientIp } from './client-ip';

// Imported by the root layout and by every Server Action / Route Handler file: the generated
// client reads each request's headers through `next/headers`, so it can only run inside a
// request. Never called from `proxy.ts`, which has no `headers()` (its refresh is a plain fetch).
configureApiClient({
  baseUrl: parseServerEnv().API_URL,
  getRequestHeaders: async () => {
    const jar = await cookies();
    const incoming = await headers();
    const token = jar.get(ACCESS_COOKIE)?.value;
    const ip = clientIp(incoming);
    return {
      ...(token && { Authorization: `Bearer ${token}` }),
      'X-Request-Id': incoming.get('x-request-id') ?? newId(),
      ...(ip && { 'X-Forwarded-For': ip }),
    };
  },
});
