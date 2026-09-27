import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';

/** Every identifier in BrewLite is a UUIDv7 (ADR 0009). */
export function newId(): string {
  return uuidv7();
}

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Accepts a UUID whose version nibble is 7 — not merely UUID-shaped (ADR 0009). */
export const zUuidV7 = z.string().refine((value) => UUID_SHAPE.test(value) && value[14] === '7', {
  message: 'Expected a UUIDv7',
});
