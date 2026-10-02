import { ApiClientError } from './api-client-error.js';
import { apiClientConfig } from './configure.js';

interface ErrorEnvelope {
  error?: { code?: unknown; details?: unknown; requestId?: unknown };
}

/**
 * The one `fetch` every generated function calls. Orval's fetch client wraps each answer as
 * `{ data, status, headers }`; `data` is the gateway's body **left whole** — the
 * `{ data, meta? }` envelope is part of every documented response, so the generated types
 * are exactly what comes back. Anything but a 2xx throws `ApiClientError`.
 * Never logs a header or a body (conventions §9.3).
 */
export async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const { baseUrl, getRequestHeaders } = apiClientConfig();

  const headers = new Headers(init.headers);
  if (init.body !== undefined && init.body !== null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  for (const [name, value] of Object.entries(await getRequestHeaders())) headers.set(name, value);

  // The web app caches no API data (conventions §11.1).
  const response = await fetch(baseUrl + url, { ...init, headers, cache: 'no-store' });

  if (response.ok) {
    const text = response.status === 204 ? '' : await response.text();
    const data = text ? (JSON.parse(text) as unknown) : undefined;
    return { data, status: response.status, headers: response.headers } as T;
  }

  let envelope: ErrorEnvelope | undefined;
  try {
    envelope = JSON.parse(await response.text()) as ErrorEnvelope;
  } catch {
    // A proxy's HTML page, not the gateway — handled below as INTERNAL.
  }
  const error = envelope?.error;
  throw new ApiClientError(
    response.status,
    typeof error?.code === 'string' ? error.code : 'INTERNAL',
    error?.details,
    typeof error?.requestId === 'string' ? error.requestId : undefined,
  );
}
