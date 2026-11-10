'use client';

import { useRouter } from 'next/navigation';
import { useLiveStream } from '@/lib/live/useLiveStream';

/** COMPLETED and CANCELLED never change again — nothing to follow. */
export const isFinalStatus = (status: string) => status === 'COMPLETED' || status === 'CANCELLED';

/**
 * Follows one order. An event only says "order X is now Y": the page **re-reads the order**
 * (`router.refresh()`) on every event and every (re)connect, so history, refunds and points always
 * come from the API (ADR 0022). A final order opens nothing.
 */
export function useOrderStream(orderId: string, status: string) {
  const router = useRouter();
  return useLiveStream(`/api/events/orders/${orderId}`, {
    enabled: !isFinalStatus(status),
    onEvent: () => router.refresh(),
  });
}
