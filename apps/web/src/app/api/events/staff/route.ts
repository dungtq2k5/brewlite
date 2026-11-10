import { passThroughStream } from '@/lib/live/pass-through';

export const dynamic = 'force-dynamic';

/** Every order's changes, for the counter's board; the gateway gates it on `order.board.read`. */
export function GET(request: Request) {
  return passThroughStream(request, '/staff/orders/events');
}
