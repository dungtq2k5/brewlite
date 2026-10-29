import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import { NextResponse, type NextRequest } from 'next/server';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

const GATEWAY_URL = (
  process.env.GATEWAY_URL ||
  process.env.API_URL ||
  'http://127.0.0.1:23100'
).replace(/\/+$/, '');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface UpstreamResponse {
  status: number;
  headers: IncomingHttpHeaders;
  body: IncomingMessage;
}

function errorResponse(code: string, status: number): NextResponse {
  return NextResponse.json(
    { error: { code } },
    { status, headers: { 'cache-control': 'no-store' } },
  );
}

/**
 * The gateway stream is opened with `node:http` rather than `fetch`: Next patches
 * `fetch` for caching and its response body is not delivered chunk-by-chunk in
 * dev, which kept the browser's `EventSource` stuck in `connecting`.
 */
function openUpstream(
  path: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<UpstreamResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${GATEWAY_URL}${path}`);
    const send = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const request = send(url, { method: 'GET', headers }, (response) => {
      resolve({
        status: response.statusCode ?? 502,
        headers: response.headers,
        body: response,
      });
    });
    const abort = () => request.destroy(new Error('aborted'));
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    request.on('error', (error) => {
      signal.removeEventListener('abort', abort);
      reject(error);
    });
    request.end();
  });
}

async function readBody(body: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

/**
 * The browser cannot attach the httpOnly access cookie to `EventSource`, so this
 * handler is the one place that carries the bearer token to the gateway stream.
 * It is deliberately a pass-through: the gateway owns ownership checks, the
 * `204` for a finished order, and the frame format (ADR 0022).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) return errorResponse('VALIDATION_FAILED', 400);

  // Middleware injects the refreshed token for this path; the cookie is the
  // fallback when middleware did not run (e.g. an internal rewrite).
  const authorization = request.headers.get('authorization');
  const cookieToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const bearer = authorization?.startsWith('Bearer ')
    ? authorization
    : cookieToken
      ? `Bearer ${cookieToken}`
      : null;
  if (!bearer) return errorResponse('UNAUTHENTICATED', 401);

  const headers: Record<string, string> = {
    authorization: bearer,
    accept: 'text/event-stream',
    'x-request-id': request.headers.get('x-request-id') ?? crypto.randomUUID(),
  };
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) headers['x-forwarded-for'] = forwardedFor;

  let upstream: UpstreamResponse;
  try {
    upstream = await openUpstream(`/api/v1/orders/${id}/events`, headers, request.signal);
  } catch {
    if (request.signal.aborted) return new Response(null, { status: 204 });
    return errorResponse('UPSTREAM_UNAVAILABLE', 503);
  }

  const responseHeaders = new Headers();
  const contentType = upstream.headers['content-type'];
  if (contentType) responseHeaders.set('content-type', contentType);
  responseHeaders.set('cache-control', 'no-cache, no-transform');
  responseHeaders.set('x-accel-buffering', 'no');

  if (upstream.status === 204) {
    upstream.body.resume();
    return new Response(null, { status: 204, headers: responseHeaders });
  }

  // A non-SSE reply is small (an error envelope), so let Next finish it normally.
  if (upstream.status !== 200 || !contentType?.includes('text/event-stream')) {
    const body = await readBody(upstream.body);
    return new Response(new Uint8Array(body), {
      status: upstream.status,
      headers: responseHeaders,
    });
  }

  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(': connected\n\n'));
      upstream.body.on('data', (chunk: Buffer) => {
        if (!cancelled) controller.enqueue(new Uint8Array(chunk));
      });
      upstream.body.on('end', () => {
        if (!cancelled) controller.close();
      });
      upstream.body.on('error', (error) => {
        if (!cancelled) controller.error(error);
      });
    },
    cancel() {
      cancelled = true;
      upstream.body.destroy();
    },
  });
  request.signal.addEventListener(
    'abort',
    () => {
      cancelled = true;
      upstream.body.destroy();
    },
    { once: true },
  );

  return new Response(stream, {
    status: 200,
    headers: responseHeaders,
  });
}
