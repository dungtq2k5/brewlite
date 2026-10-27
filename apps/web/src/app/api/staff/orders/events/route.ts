import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { env } from '@/config/env.schema';

export const dynamic = 'force-dynamic';

export async function GET() {
  const jar = await cookies();
  const token = jar.get('bl_at')?.value;

  if (!token) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', details: 'Missing bl_at cookie' } },
      { status: 401 },
    );
  }

  try {
    const upstream = await fetch(`${env.API_URL}/staff/orders/events`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Request-Id': crypto.randomUUID(),
      },
      cache: 'no-store',
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: { code: 'SSE_UPSTREAM_ERROR', details: upstream.statusText } },
        { status: upstream.status },
      );
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'GATEWAY_UNREACHABLE' } },
      { status: 503 },
    );
  }
}