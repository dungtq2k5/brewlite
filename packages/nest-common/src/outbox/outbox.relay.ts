import { Logger } from '@nestjs/common';
import { headers, type JetStreamClient } from 'nats';

/** One consumer of these — the relay itself (conventions §3.1). */
export const OUTBOX_BATCH_SIZE = 50;
export const OUTBOX_POLL_MS = 200;
export const OUTBOX_PUBLISH_TIMEOUT_MS = 2_000;
const MAX_BACKOFF_MS = 10_000;

interface ClaimedRow {
  id: string;
  subject: string;
  payload: unknown;
  request_id: string | null;
}

/**
 * Every Prisma client (classic or the driver adapter) offers these — nest-common cannot
 * import a service's generated client (conventions §2.1). `outbox_events` has the same
 * physical shape in every publishing service (rdm-spec §2.7).
 */
export interface OutboxRelayTransactionClient {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
}

export interface OutboxRelayClient {
  $transaction<T>(
    fn: (tx: OutboxRelayTransactionClient) => Promise<T>,
    options?: { timeout: number },
  ): Promise<T>;
}

/**
 * The only publisher (architecture §2.3). One cycle claims a batch under `FOR UPDATE SKIP LOCKED`
 * — two replicas never publish the same row — publishes each row in `id` order, stopping
 * at the first failure so one aggregate's events keep their order, then marks the
 * acknowledged rows published inside the same transaction that held the row lock.
 */
export class OutboxRelay {
  private readonly logger = new Logger(OutboxRelay.name);
  private running = false;
  private consecutiveFailures = 0;
  private readonly stopWaiters: (() => void)[] = [];
  private cycleInFlight: Promise<void> = Promise.resolve();

  constructor(
    private readonly db: OutboxRelayClient,
    private readonly jsc: JetStreamClient,
  ) {}

  start(): void {
    this.running = true;
    this.cycleInFlight = this.loop();
  }

  /** Resolves once the current cycle finishes and the loop has stopped — call before draining NATS. */
  async stop(): Promise<void> {
    this.running = false;
    await this.cycleInFlight;
  }

  private async loop(): Promise<void> {
    while (this.running) {
      let claimed = 0;
      try {
        claimed = await this.runCycle();
        this.consecutiveFailures = 0;
      } catch (error) {
        this.consecutiveFailures += 1;
        this.logger.error(
          `relay cycle failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      if (!this.running) break;
      await this.pace(claimed);
    }
    this.stopWaiters.splice(0).forEach((resolve) => resolve());
  }

  private async pace(claimed: number): Promise<void> {
    if (this.consecutiveFailures > 0) {
      const backoff = Math.min(MAX_BACKOFF_MS, 1_000 * 2 ** (this.consecutiveFailures - 1));
      await sleep(backoff);
      return;
    }
    if (claimed >= OUTBOX_BATCH_SIZE) return; // a full batch — claim again at once
    await sleep(OUTBOX_POLL_MS);
  }

  /** Returns the number of rows claimed, for pacing. */
  private async runCycle(): Promise<number> {
    const timeout = OUTBOX_BATCH_SIZE * OUTBOX_PUBLISH_TIMEOUT_MS + 5_000;
    return this.db.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<ClaimedRow[]>`
        SELECT id, subject, payload, request_id
        FROM outbox_events
        WHERE published_at IS NULL
        ORDER BY id
        LIMIT ${OUTBOX_BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      `;
        if (rows.length === 0) return 0;

        const published: string[] = [];
        let failure: { id: string; message: string } | undefined;
        for (const row of rows) {
          try {
            await this.publishOne(row);
            published.push(row.id);
          } catch (error) {
            failure = {
              id: row.id,
              message: (error instanceof Error ? error.message : String(error)).slice(0, 500),
            };
            break; // stop the batch — later rows wait, so one aggregate's events keep their order
          }
        }

        if (published.length > 0) {
          await tx.$executeRaw`
          UPDATE outbox_events SET published_at = now()
          WHERE id = ANY(${published}::uuid[])
        `;
        }
        if (failure) {
          await tx.$executeRaw`
          UPDATE outbox_events SET attempts = attempts + 1, last_error = ${failure.message}
          WHERE id = ${failure.id}
        `;
        }
        return rows.length;
      },
      { timeout },
    );
  }

  private async publishOne(row: ClaimedRow): Promise<void> {
    const hdrs = headers();
    if (row.request_id) hdrs.set('x-request-id', row.request_id);
    // jsonb comes back already parsed by the pg driver adapter; a plain string is passed through.
    const data = typeof row.payload === 'string' ? row.payload : JSON.stringify(row.payload);
    await this.jsc.publish(row.subject, new TextEncoder().encode(data), {
      msgID: row.id,
      timeout: OUTBOX_PUBLISH_TIMEOUT_MS,
      headers: hdrs,
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
