import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeliverPolicy, type ConsumerMessages, type NatsConnection } from 'nats';
import { Observable, Subject } from 'rxjs';
import { orderStatusChangedPayload } from '@brewlite/contracts';
import {
  connectNats,
  ensureStreams,
  NatsConnectionTracker,
  type ReadinessCheck,
} from '@brewlite/nest-common';
import type { Env } from '../config/env.schema.js';
import { toFrame, type OrderStatusFrame } from './order-status-frame.js';

const SUBJECT = 'ordering.order.status_changed';
const RETRY_MS = 5_000;

/**
 * The one non-durable consumer (architecture §2.3): an ordered, ephemeral consumer with
 * deliver policy `new`, fanned out through an in-process `Subject` — one NATS
 * subscription serves every open stream. Frames missed during an outage are lost on
 * purpose: the page re-reads the order on every (re)connect (ADR 0022).
 * ponytail: no cap on open streams — add one when there is a reason.
 */
@Injectable()
export class OrderEventsSource implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(OrderEventsSource.name);
  private readonly subject = new Subject<OrderStatusFrame>();
  private tracker?: NatsConnectionTracker;
  private nc?: NatsConnection;
  private messages?: ConsumerMessages;
  private stopped = false;

  readonly frames$: Observable<OrderStatusFrame> = this.subject.asObservable();

  constructor(private readonly config: ConfigService<Env, true>) {}

  onModuleInit(): void {
    void this.run();
  }

  /** False until connected, and while the connection is down — only the streams depend on it. */
  readinessCheck(): ReadinessCheck {
    return () => (this.tracker ? this.tracker.readinessCheck()() : Promise.resolve(false));
  }

  private async run(): Promise<void> {
    while (!this.stopped) {
      try {
        this.nc ??= await connectNats(this.config.get('NATS_URL', { infer: true }), {
          resilient: true,
        });
        this.tracker ??= new NatsConnectionTracker(this.nc);
        const jsm = await this.nc.jetstreamManager();
        await ensureStreams(jsm, ['ORDERING']);
        const consumer = await this.nc.jetstream().consumers.get('ORDERING', {
          filterSubjects: [SUBJECT],
          deliver_policy: DeliverPolicy.New,
        });
        this.messages = await consumer.consume();
        for await (const msg of this.messages) this.publish(msg.data);
      } catch (error) {
        if (this.stopped) return;
        this.logger.warn({ err: error }, 'order events source failed; retrying');
      }
      if (!this.stopped) await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
    }
  }

  private publish(data: Uint8Array): void {
    try {
      const parsed = orderStatusChangedPayload.safeParse(
        JSON.parse(new TextDecoder().decode(data)),
      );
      if (!parsed.success) throw new Error(parsed.error.message);
      this.subject.next(toFrame(parsed.data));
    } catch (error) {
      // No DLQ for an ephemeral consumer, and nothing depends on the dropped frame.
      this.logger.warn({ err: error }, 'dropped an invalid order.status_changed frame');
    }
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    await this.messages?.close();
    await this.nc?.drain();
    this.subject.complete();
  }
}
