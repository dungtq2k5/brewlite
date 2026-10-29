import { NextResponse, type NextRequest } from 'next/server';
import { proxyGatewayStream } from '@/lib/gateway-sse';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_FAILED' } },
      { status: 400, headers: { 'cache-control': 'no-store' } },
    );
  }
  return proxyGatewayStream(request, `/api/v1/orders/${id}/events`);
}
