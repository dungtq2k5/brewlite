'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const FIRST_RETRY_MS = 5000;
const LAST_RETRY_MS = 30_000;
const RECONNECTING_AFTER_MS = 3000;

/** COMPLETED and CANCELLED never change again — nothing to follow. */
export const isFinalStatus = (status: string) => status === 'COMPLETED' || status === 'CANCELLED';

/** What the stream route answers right now — the status only; a `200` stream is dropped at once. */
async function probe(orderId: string): Promise<number> {
  const abort = new AbortController();
  try {
    const { status } = await fetch(`/api/events/orders/${orderId}`, { signal: abort.signal });
    return status;
  } catch {
    return 0;
  } finally {
    abort.abort();
  }
}

/**
 * Follows one order. An event only says "order X is now Y": the page **re-reads the order**
 * (`router.refresh()`) on every event and every (re)connect, so history, refunds and points always
 * come from the API (ADR 0022). A final order opens nothing. `reconnecting` appears only after 3 s
 * without a stream — a blink between two connections is not worth a banner.
 */
export function useOrderStream(orderId: string, status: string) {
  const router = useRouter();
  const final = isFinalStatus(status);
  const [open, setOpen] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (final) return;
    let source: EventSource | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let delay = FIRST_RETRY_MS;
    let stopped = false;

    const connect = () => {
      source = new EventSource(`/api/events/orders/${orderId}`);
      source.onopen = () => {
        delay = FIRST_RETRY_MS;
        setOpen(true);
        setSlow(false);
        router.refresh();
      };
      source.addEventListener('order.status', () => router.refresh());
      source.onerror = () => {
        setOpen(false);
        // CONNECTING: the browser is retrying by itself. CLOSED: it gave up (204, 401, 404…).
        if (source?.readyState !== EventSource.CLOSED) return;
        source.close();
        // Refresh only when the order itself changed under us (final, gone, signed out). While the
        // API is down a refresh would fail in the layout and replace the page with an error.
        void probe(orderId).then((status) => {
          if (stopped) return;
          if (status === 204 || status === 401 || status === 404) router.refresh();
          retry = setTimeout(connect, delay);
          delay = Math.min(delay * 2, LAST_RETRY_MS);
        });
      };
    };
    connect();

    return () => {
      stopped = true;
      source?.close();
      clearTimeout(retry);
      setOpen(false);
    };
  }, [orderId, final, router]);

  useEffect(() => {
    if (final || open) return;
    const timer = setTimeout(() => setSlow(true), RECONNECTING_AFTER_MS);
    return () => clearTimeout(timer);
  }, [final, open]);

  return { live: !final && open, reconnecting: !final && !open && slow };
}
