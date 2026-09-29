import { Injectable } from '@nestjs/common';
import { newId, EVENT_SCHEMAS, type EventSubject } from '@brewlite/contracts';
import { getRequestId } from '../grpc/request-context.js';

/** Structurally the same shape as every Prisma client's `InputJsonValue`. */
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
/** Every event payload is an object — Prisma's `Json` column type refuses a bare `null` without its own `JsonNull` sentinel. */
type JsonObject = { [key: string]: JsonValue };

/**
 * What every service's own Prisma `OutboxEvent` model must offer to write through this
 * — a structural type, since nest-common cannot import a service's generated client
 * (conventions §2.1).
 */
export interface OutboxTransactionClient {
  outboxEvent: {
    create(args: {
      data: {
        id: string;
        subject: string;
        payload: JsonObject;
        aggregateId: string;
        requestId: string | null;
      };
    }): Promise<unknown>;
  };
}

type EventPayload<S extends EventSubject> = (typeof EVENT_SCHEMAS)[S] extends {
  parse: (value: unknown) => infer P;
}
  ? P
  : never;

/**
 * The only way a service writes an event — inside the same transaction as the business
 * write it describes (ADR 0006). 05b's relay is the only reader of these rows; nothing
 * publishes them yet.
 */
@Injectable()
export class OutboxService {
  async add<S extends EventSubject>(
    tx: OutboxTransactionClient,
    subject: S,
    aggregateId: string,
    payload: Omit<EventPayload<S>, 'eventId' | 'occurredAt'>,
  ): Promise<void> {
    const id = newId();
    const full = { ...payload, eventId: id, occurredAt: new Date().toISOString() };
    // A payload failing its own subject's schema fails the business transaction it rode
    // in on (conventions §8.1) — an event that cannot be trusted is never written.
    const parsed = EVENT_SCHEMAS[subject].parse(full) as unknown as JsonObject;
    await tx.outboxEvent.create({
      data: { id, subject, payload: parsed, aggregateId, requestId: getRequestId() ?? null },
    });
  }
}
