import 'server-only';
import { configureApiClient } from '@brewlite/api-client';
import { parseServerEnv } from '@/config/env.schema';
import { requestHeaders } from './request-headers';

// Imported by the root layout and by every Server Action / Route Handler file: the generated
// client reads each request's headers through `next/headers`, so it can only run inside a
// request. Never called from `proxy.ts`, which has no `headers()` (its refresh is a plain fetch).
configureApiClient({ baseUrl: parseServerEnv().API_URL, getRequestHeaders: requestHeaders });
