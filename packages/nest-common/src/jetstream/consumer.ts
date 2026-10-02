import { Logger } from '@nestjs/common';
import {
  AckPolicy,
  DeliverPolicy,
  headers,
  nanos,
  type ConsumerMessages,
  type JetStreamClient,
  type JetStreamManager,
  type JsMsg,
} from 'nats';
import { EVENT_SCHEMAS, type EventPayload, type EventSubject } from '@brewlite/contracts';
import { runWithRequestId } from '../grpc/request-context.js';
import { dlqSubject } from './dead-letter.js';

/** A handler throws this to dead-letter immediately, regardless of delivery count (architecture §2.3). */
export class PoisonMessage extends Error {}

const MAX_DELIVER = 10;
const ACK_WAIT_MS = 30_000;
/** By delivery count (1-indexed) — the last entry repeats for any delivery beyond it. */
const NAK_DELAYS_MS = [1_000, 5_000, 30_000, 120_000, 300_000];

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

  /** Ensures the durable consumer exists on `streamName` and starts consuming forever. */
  async start(
    jsc: JetStreamClient,
    jsm: JetStreamManager,
    streamName: string,
  ): Promise<ConsumerMessages> {
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
    void this.consumeLoop(jsc, messages);
    return messages;
  }

  private async consumeLoop(jsc: JetStreamClient, messages: ConsumerMessages): Promise<void> {
    for await (const msg of messages) {
      await this.handleOne(jsc, msg);
    }
  }

  private async handleOne(jsc: JetStreamClient, msg: JsMsg): Promise<void> {
    const requestId = msg.headers?.get('x-request-id') || msg.seq.toString();
    await runWithRequestId(requestId, async () => {
      try {
        const raw: unknown = JSON.parse(new TextDecoder().decode(msg.data));
        const parsed = EVENT_SCHEMAS[this.subject].safeParse(raw);
        if (!parsed.success) throw new PoisonMessage(parsed.error.message);
        await this.handle(parsed.data as EventPayload<S>);
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
