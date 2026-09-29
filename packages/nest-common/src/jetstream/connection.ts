import { connect, type NatsConnection } from 'nats';

/** One connection per process (ADR 0005) — the caller stops it on shutdown via `.drain()`. */
export async function connectNats(url: string): Promise<NatsConnection> {
  return connect({ servers: url });
}
