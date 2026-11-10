import { Logger } from '@nestjs/common';
import {
  AckPolicy,
  ConsumerEvents,
  DeliverPolicy,
  headers,
  nanos,
  type ConsumerMessages,
  type JetStreamClient,
  type JetStreamManager,
  type JsMsg,
} from 'nats';
import {
  EVENT_SCHEMAS,
  STREAMS,
  type EventPayload,
  type EventSubject,
  type StreamDefinition,
} from '@brewlite/contracts';
import { runWithRequestId } from '../grpc/request-context.js';
import { dlqSubject } from './dead-letter.js';
import { ensureStreams } from './streams.js';

/** A handler throws this to dead-letter immediately, regardless of delivery count (architecture §2.3). */
export class PoisonMessage extends Error {}

const MAX_DELIVER = 10;
const ACK_WAIT_MS = 30_000;
/** By delivery count (1-indexed) — the last entry repeats for any delivery beyond it. */
const NAK_DELAYS_MS = [1_000, 5_000, 30_000, 120_000, 300_000];

/** The statuses that mean the consumer, or its stream, is gone — a NATS reset. */
const GONE = new Set<string>([
  ConsumerEvents.ConsumerDeleted,
  ConsumerEvents.ConsumerNotFound,
  ConsumerEvents.StreamNotFound,
]);
const RESUME_FIRST_MS = 1_000;
const RESUME_MAX_MS = 30_000;

/** What `start()` hands back: closing it stops the consumer for good (module shutdown). */
export interface ConsumerHandle {
  close(): Promise<void>;
}

function nakDelayFor(deliveryCount: number): number {
  return NAK_DELAYS_MS[Math.min(deliveryCount - 1, NAK_DELAYS_MS.length - 1)];
}

/**
 * The base class of every durable consumer (conventions §8.2). A subclass names its `service`
 * and `subject`, and does one thing in `handle` — its own idempotent write. Everything
 * else (ack/nak/dead-letter, the request id, schema validation) lives here once.
 */
export abstract class JetStreamConsumer<S extends EventSubject> {
  abstract readonly service: string;
  abstract readonly subject: S;
  abstract handle(payload: EventPayload<S>): Promise<void>;

  private readonly logger = new Logger(this.constructor.name);

  /** `<service>-<subject with dots as dashes>` — renaming it later replays the stream. */
  get durable(): string {
    return `${this.service}-${this.subject.replaceAll('.', '-')}`;
  }

  /**
   * Ensures the durable consumer exists on `streamName` and consumes forever. When the message
   * iterator ends or throws — the consumer or its stream was deleted (a NATS reset under a running
   * service), heartbeats were missed — it waits (1 s, doubling to 30 s), re-creates the stream and
   * the consumer, and consumes again. Only `close()` stops it. The first set-up's errors throw, as
   * at boot before.
   */
  async start(
    jsc: JetStreamClient,
    jsm: JetStreamManager,
    streamName: string,
    /** Overridable so a test can run this on a private stream, never on the real ones. */
    definitions: readonly StreamDefinition[] = STREAMS,
  ): Promise<ConsumerHandle> {
    let stopped = false;
    let current = await this.open(jsc, jsm, streamName);
    // The dead-letter stream goes with a NATS reset too; a private test stream has none.
    const streams = definitions === STREAMS ? [streamName, 'DLQ'] : [streamName];

    void (async () => {
      let delay = RESUME_FIRST_MS;
      while (!stopped) {
        try {
          await this.consumeLoop(jsc, current);
        } catch (error) {
          this.logger.warn(`consuming ${this.subject} failed: ${errorMessage(error)}`);
        }
        // Resume: the iterator ended without close() — re-create what is missing and go on.
        while (!stopped) {
          await sleep(delay);
          if (stopped) break;
          try {
            await ensureStreams(jsm, streams, definitions);
            current = await this.open(jsc, jsm, streamName);
            this.logger.warn(`${this.durable} on ${streamName} re-created — consuming again`);
            delay = RESUME_FIRST_MS;
            break;
          } catch (error) {
            delay = Math.min(RESUME_MAX_MS, delay * 2);
            this.logger.warn(`re-creating ${this.durable} failed: ${errorMessage(error)}`);
          }
        }
      }
    })();

    return {
      close: async () => {
        stopped = true;
        await current.close();
      },
    };
  }

  private async open(
    jsc: JetStreamClient,
    jsm: JetStreamManager,
    streamName: string,
  ): Promise<ConsumerMessages> {
    // Idempotent: an existing durable with this config is returned as it is.
    await jsm.consumers.add(streamName, {
      durable_name: this.durable,
      ack_policy: AckPolicy.Explicit,
      max_deliver: MAX_DELIVER,
      ack_wait: nanos(ACK_WAIT_MS),
      filter_subject: this.subject,
      deliver_policy: DeliverPolicy.All,
    });
    const consumer = await jsc.consumers.get(streamName, this.durable);
    const messages = await consumer.consume();
    // nats.js keeps a deleted consumer's iterator open and retries forever, reporting it only on
    // the status stream — end the iterator ourselves, so `start()`'s loop re-creates it.
    void (async () => {
      for await (const status of await messages.status()) {
        if (GONE.has(status.type as string)) {
          this.logger.warn(`${this.durable} on ${streamName}: ${status.type}`);
          await messages.close();
          break;
        }
      }
    })();
    return messages;
  }

  private async consumeLoop(jsc: JetStreamClient, messages: ConsumerMessages): Promise<void> {
    for await (const msg of messages) {
      await this.handleOne(jsc, msg);
    }
  }

  /** The payload, validated against the subject's schema; a test on a private subject overrides it. */
  protected parse(raw: unknown): EventPayload<S> {
    const parsed = EVENT_SCHEMAS[this.subject].safeParse(raw);
    if (!parsed.success) throw new PoisonMessage(parsed.error.message);
    return parsed.data as EventPayload<S>;
  }

  private async handleOne(jsc: JetStreamClient, msg: JsMsg): Promise<void> {
    const requestId = msg.headers?.get('x-request-id') || msg.seq.toString();
    await runWithRequestId(requestId, async () => {
      try {
        const raw: unknown = JSON.parse(new TextDecoder().decode(msg.data));
        await this.handle(this.parse(raw));
        msg.ack();
      } catch (error) {
        await this.handleFailure(jsc, msg, error);
      }
    });
  }

  private async handleFailure(jsc: JetStreamClient, msg: JsMsg, error: unknown): Promise<void> {
    const isFinalDelivery = msg.info.deliveryCount >= MAX_DELIVER;
    if (error instanceof PoisonMessage || isFinalDelivery) {
      this.logger.error(
        `dead-lettering ${this.subject} (delivery ${msg.info.deliveryCount}): ${String(error instanceof Error ? error.message : error)}`,
      );
      await this.deadLetter(jsc, msg, error);
      msg.term(error instanceof Error ? error.message : String(error));
      return;
    }
    msg.nak(nakDelayFor(msg.info.deliveryCount));
  }

  private async deadLetter(jsc: JetStreamClient, msg: JsMsg, error: unknown): Promise<void> {
    const hdrs = headers();
    if (msg.headers) {
      for (const [key, values] of msg.headers) {
        for (const value of values) hdrs.append(key, value);
      }
    }
    const message = error instanceof Error ? error.message : String(error);
    // A header value can't carry \r or \n — a multi-line zod error would otherwise
    // throw here, on the one path that must never itself fail to dead-letter.
    hdrs.set('x-dlq-error', message.replaceAll(/[\r\n]+/g, ' ').slice(0, 500));
    await jsc.publish(dlqSubject(this.service, this.durable), msg.data, { headers: hdrs });
  }
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
