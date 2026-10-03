import { ORDERING_EVENT_SCHEMAS } from './ordering.events.js';
import { PAYMENT_EVENT_SCHEMAS } from './payment.events.js';

/** Every subject declared, its payload schema — api-endpoints-plan §8: a subject not here does not exist. */
export const EVENT_SCHEMAS = {
  ...ORDERING_EVENT_SCHEMAS,
  ...PAYMENT_EVENT_SCHEMAS,
} as const;

export type EventSubject = keyof typeof EVENT_SCHEMAS;

export type EventPayload<S extends EventSubject> = (typeof EVENT_SCHEMAS)[S] extends {
  parse: (value: unknown) => infer P;
}
  ? P
  : never;

export interface StreamDefinition {
  name: string;
  subjects: readonly string[];
  maxAgeMs: number;
  /** NATS applies its own 2-minute default for an unset value rather than storing 0 — always state it explicitly. */
  duplicateWindowMs: number;
}

const DAY_MS = 24 * 60 * 60_000;

/** api-endpoints-plan §8 — the relay (architecture §2.3) creates these against NATS JetStream. */
export const STREAMS: readonly StreamDefinition[] = [
  {
    name: 'ORDERING',
    subjects: ['ordering.>'],
    maxAgeMs: 7 * DAY_MS,
    duplicateWindowMs: 2 * 60_000,
  },
  { name: 'PAYMENT', subjects: ['payment.>'], maxAgeMs: 7 * DAY_MS, duplicateWindowMs: 2 * 60_000 },
  // NATS applies its own 2-minute default for an unset/zero duplicate_window rather than
  // storing a literal 0 — declaring it explicitly keeps ensureStreams' comparison stable
  // across restarts instead of drifting the moment the stream is first created.
  { name: 'DLQ', subjects: ['dlq.>'], maxAgeMs: 30 * DAY_MS, duplicateWindowMs: 2 * 60_000 },
];
