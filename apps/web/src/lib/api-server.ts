import 'server-only';
import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ApiClientError, configureApiClient } from '@brewlite/api-client';
import { env } from '@/config/env.schema';

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  code?: string;
  details?: unknown;
  status?: number;
}

let isConfigured = false;

export function ensureApiClientConfigured(): void {
  if (isConfigured) return;
  configureApiClient({
    baseUrl: env.API_URL,
    getRequestHeaders: async () => {
      const out: Record<string, string> = {
        'X-Request-Id': crypto.randomUUID(),
      };
      try {
        const jar = await cookies();
        const token = jar.get('bl_at')?.value;
        if (token) {
          out['Authorization'] = `Bearer ${token}`;
        }
        const hdrs = await headers();
        const forwardedFor = hdrs.get('x-forwarded-for');
        if (forwardedFor) {
          out['X-Forwarded-For'] = forwardedFor;
        }
      } catch {
        // Bỏ qua nếu gọi ngoài phạm vi request
      }
      return out;
    },
  });
  isConfigured = true;
}

export interface ServerUser {
  id: string;
  email: string;
  fullName?: string;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
  preferredLocale?: 'vi' | 'en';
}

export async function getServerUser(): Promise<ServerUser | null> {
  try {
    const jar = await cookies();
    const raw = jar.get('bl_user')?.value;
    if (raw) {
      return JSON.parse(raw) as ServerUser;
    }
  } catch {
    // Ignore error
  }
  return null;
}

export async function requireServerAuth(): Promise<void> {
  ensureApiClientConfigured();
  const jar = await cookies();
  if (!jar.get('bl_at')?.value) {
    redirect('/login');
  }
}

export function handlePageApiError(err: unknown): never {
  if (err instanceof ApiClientError && (err.status === 401 || err.status === 403)) {
    redirect('/login');
  }
  throw err;
}

export async function executeServerAction<T>(
  apiCall: () => Promise<{ data: unknown; status: number }>,
  revalidateUrl?: string,
): Promise<ActionResult<T>> {
  ensureApiClientConfigured();
  try {
    const res = await apiCall();
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
    }
    const body = res.data as { data?: T } | undefined;
    const unwrapped = body && typeof body === 'object' && 'data' in body ? body.data : (res.data as T);
    return { ok: true, data: unwrapped, status: res.status };
  } catch (err) {
    if (err instanceof ApiClientError) {
      return {
        ok: false,
        code: err.code,
        details: err.details,
        status: err.status,
      };
    }
    return {
      ok: false,
      code: 'NETWORK_OR_GATEWAY_OFFLINE',
      details: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}