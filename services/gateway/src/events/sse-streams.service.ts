import { Injectable, type BeforeApplicationShutdown } from '@nestjs/common';
import type { Request, Response } from 'express';
import { filter, interval, map, merge, share } from 'rxjs';
import { OrderStatus } from '@brewlite/contracts';
import { OrderEventsSource } from './order-events.source.js';
import { formatFrame, type OrderStatusFrame } from './order-status-frame.js';

export const PING_MS = 25_000;

export interface StreamOptions {
  accepts: (frame: OrderStatusFrame) => boolean;
  /** The stream ends after writing a frame with one of these statuses. */
  endAfter?: ReadonlySet<OrderStatus>;
}

/**
 * Writes `text/event-stream` by hand — Nest's `@Sse()` cannot write a comment line,
 * answer `204`, or end a stream after a chosen event. One shared ping timer serves every
 * open stream, never one per connection.
 */
@Injectable()
export class SseStreams implements BeforeApplicationShutdown {
  private readonly open = new Set<() => void>();
  private readonly pings$ = interval(PING_MS).pipe(
    map(() => null),
    share(),
  );

  constructor(private readonly source: OrderEventsSource) {}

  attach(req: Request, res: Response, { accepts, endAfter }: StreamOptions): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    const close = (): void => {
      subscription.unsubscribe();
      this.open.delete(close);
      if (!res.writableEnded) res.end();
    };
    const subscription = merge(this.source.frames$.pipe(filter(accepts)), this.pings$).subscribe(
      (item) => {
        if (item === null) {
          res.write(': ping\n\n');
          return;
        }
        res.write(formatFrame(item));
        if (endAfter?.has(item.status)) close();
      },
    );
    this.open.add(close);
    req.on('close', close);
  }

  /** Before, not after: `app.close()` waits on open connections before `onApplicationShutdown` runs. */
  beforeApplicationShutdown(): void {
    for (const close of [...this.open]) close();
  }
}
