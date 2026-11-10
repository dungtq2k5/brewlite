'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { pageChangedBy } from './probe-rule';

const FIRST_RETRY_MS = 5000;
const LAST_RETRY_MS = 30_000;
const RECONNECTING_AFTER_MS = 3000;

/** What the stream's `order.status` event says: an order is now in this status. */
export interface OrderStatusFrame {
  orderId: string;
  orderNo: string;
  status: string;
  at: string;
}

/**
 * What the stream route answers right now — the status only; a `200` stream is dropped at once.
 * See `pageChangedBy` for what each answer means.
 */
async function probe(url: string): Promise<number> {
  const abort = new AbortController();
  try {
    const { status } = await fetch(url, { signal: abort.signal });
    return status;
  } catch {
    return 0;
  } finally {
    abort.abort();
  }
}

/**
 * One server-sent stream, shared by the tracking page and the staff board. Every (re)connect
 * re-reads the page (`router.refresh()`) — it closes the gap between render and connect and recovers
 * anything missed while down; each `order.status` event goes to `onEvent`, which decides whether it
 * matters. A closed stream is probed and refreshes the page only when the answer says the page's
 * truth changed (`pageChangedBy`) — while the API is down a refresh would fail in the layout and
 * replace the page with an error; otherwise it retries after 5 s, doubling to 30 s.
 * `reconnecting` appears only after 3 s without a stream.
 */
export function useLiveStream(
  url: string,
  { enabled, onEvent }: Readonly<{ enabled: boolean; onEvent: (frame: OrderStatusFrame) => void }>,
) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slow, setSlow] = useState(false);
  // The latest callback without reconnecting every time it changes.
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  });

  useEffect(() => {
    if (!enabled) return;
    let source: EventSource | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let delay = FIRST_RETRY_MS;
    let stopped = false;

    const connect = () => {
      source = new EventSource(url);
      source.onopen = () => {
        delay = FIRST_RETRY_MS;
        setOpen(true);
        setSlow(false);
        router.refresh();
      };
      source.addEventListener('order.status', (event) => {
        try {
          handler.current(JSON.parse((event as MessageEvent<string>).data) as OrderStatusFrame);
        } catch {
          // A frame that is not JSON says nothing the page can use.
        }
      });
      source.onerror = () => {
        setOpen(false);
        // CONNECTING: the browser is retrying by itself. CLOSED: it gave up (204, 401, 403, 404…).
        if (source?.readyState !== EventSource.CLOSED) return;
        source.close();
        void probe(url).then((status) => {
          if (stopped) return;
          if (pageChangedBy(status)) router.refresh();
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
  }, [url, enabled, router]);

  useEffect(() => {
    if (!enabled || open) return;
    const timer = setTimeout(() => setSlow(true), RECONNECTING_AFTER_MS);
    return () => clearTimeout(timer);
  }, [enabled, open]);

  return { live: enabled && open, reconnecting: enabled && !open && slow };
}
