import { cookies } from 'next/headers';
import { zUuidV7 } from '@brewlite/contracts';
import { parseServerEnv } from '@/config/env.schema';
import { ACCESS_COOKIE } from '@/lib/cookies';
import { requestHeaders } from '@/lib/request-headers';

export const dynamic = 'force-dynamic';

/**
 * The browser's `EventSource` cannot send the bearer token, so this passes the gateway's order
 * stream through (ADR 0022): the cookie becomes the header, and a closed browser aborts the
 * upstream. A hand-written fetch because the generated client buffers (conventions §11.1).
 * Anything but `200` goes back as the same bare status — a `204` is "final" to an EventSource.
 */
export async function GET(
  request: Request,
  { params }: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const { id } = await params;
  if (!zUuidV7.safeParse(id).success) return new Response(null, { status: 404 });
  if (!(await cookies()).has(ACCESS_COOKIE)) return new Response(null, { status: 401 });

  let upstream: Response;
  try {
    upstream = await fetch(`${parseServerEnv().API_URL}/orders/${id}/events`, {
      headers: { Accept: 'text/event-stream', ...(await requestHeaders()) },
      signal: request.signal,
      cache: 'no-store',
    });
  } catch {
    return new Response(null, { status: 502 });
  }
  if (upstream.status !== 200 || !upstream.body) {
    await upstream.body?.cancel();
    return new Response(null, { status: upstream.status === 200 ? 502 : upstream.status });
  }
  // A first comment line so the browser sees headers (and fires `open`) now, not at the gateway's
  // next 25-second ping.
  const encoder = new TextEncoder();
  const reader = upstream.body.getReader();
  const body = new ReadableStream<Uint8Array>({
    start: (controller) => controller.enqueue(encoder.encode(': connected\n\n')),
    pull: async (controller) => {
      const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined }));
      if (done) controller.close();
      else controller.enqueue(value);
    },
    cancel: (reason) => reader.cancel(reason),
  });
  return new Response(body, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform' },
  });
}
