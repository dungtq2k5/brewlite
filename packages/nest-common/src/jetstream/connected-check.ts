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
  private connected = true;

  constructor(private readonly nc: NatsConnection) {
    void this.watch();
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
