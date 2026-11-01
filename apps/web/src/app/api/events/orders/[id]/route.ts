import { zUuidV7 } from '@brewlite/contracts';
import { passThroughStream } from '@/lib/live/pass-through';

export const dynamic = 'force-dynamic';

/** One order's stream (ADR 0022); a malformed id is a `404` before anything is asked of the API. */
export async function GET(
  request: Request,
  { params }: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const { id } = await params;
  if (!zUuidV7.safeParse(id).success) return new Response(null, { status: 404 });
  return passThroughStream(request, `/orders/${id}/events`);
}
