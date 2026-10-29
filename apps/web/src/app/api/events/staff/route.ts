import type { NextRequest } from 'next/server';
import { proxyGatewayStream } from '@/lib/gateway-sse';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

/**
 * Staff board stream. Like the customer stream this is only a pass-through: the
 * gateway checks `order.board.read` and owns the frame format.
 */
export async function GET(request: NextRequest): Promise<Response> {
  return proxyGatewayStream(request, '/api/v1/staff/orders/events');
}
