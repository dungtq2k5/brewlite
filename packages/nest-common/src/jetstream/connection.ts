import { connect, type NatsConnection } from 'nats';

export interface ConnectNatsOptions {
  /** Wait (rather than reject) when the broker is down at boot, and never stop reconnecting. */
  resilient?: boolean;
}

/** One connection per process (ADR 0005) — the caller stops it on shutdown via `.drain()`. */
export async function connectNats(
  url: string,
  { resilient = false }: ConnectNatsOptions = {},
): Promise<NatsConnection> {
  return connect(
    resilient
      ? { servers: url, waitOnFirstConnect: true, maxReconnectAttempts: -1 }
      : { servers: url },
  );
}
