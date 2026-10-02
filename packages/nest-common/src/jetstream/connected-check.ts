import { Logger } from '@nestjs/common';
import { Events, type NatsConnection } from 'nats';
import type { ReadinessCheck } from '../health/readiness.js';

/**
 * `nc.isClosed()` only reflects a *permanently* dead connection (explicitly closed, or
 * reconnect attempts exhausted) — during a live outage the client is silently retrying
 * and reports `isClosed() === false` the whole time, so readiness would never flip to
 * unhealthy. This tracks `nc.status()`'s disconnect/reconnect events instead
 * (api-endpoints-plan §11).
 */
export class NatsConnectionTracker {
  private readonly logger = new Logger(NatsConnectionTracker.name);
  private connected = true;
  private watcher?: Promise<void>;

  constructor(private readonly nc: NatsConnection) {}

  /** Starts watching, once; chainable. A watcher that fails marks the tracker not ready. */
  start(): this {
    this.watcher ??= this.watch().catch((error: unknown) => {
      this.connected = false;
      this.logger.error({ err: error }, 'NATS status watcher stopped — reporting not ready');
    });
    return this;
  }

  private async watch(): Promise<void> {
    for await (const status of this.nc.status()) {
      if (status.type === Events.Disconnect) this.connected = false;
      if (status.type === Events.Reconnect) this.connected = true;
    }
  }

  readinessCheck(): ReadinessCheck {
    return () => Promise.resolve(this.connected && !this.nc.isClosed());
  }
}
