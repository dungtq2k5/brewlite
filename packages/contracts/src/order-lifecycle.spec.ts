import { describe, expect, it } from 'vitest';
import { canTransition } from './order-lifecycle.js';
import { OrderStatus } from './enums.js';

const ALLOWED = new Set([
  'PENDING->PAID',
  'PENDING->PAYMENT_FAILED',
  'PENDING->CANCELLED',
  'PAYMENT_FAILED->PENDING',
  'PAYMENT_FAILED->CANCELLED',
  'PAID->PREPARING',
  'PAID->CANCELLED',
  'PREPARING->READY',
  'READY->COMPLETED',
]);

describe('canTransition — the full 7 x 7 grid against product-overview §6.4', () => {
  const statuses = Object.values(OrderStatus);
  for (const from of statuses) {
    for (const to of statuses) {
      const key = `${from}->${to}`;
      it(`${key} is ${ALLOWED.has(key) ? 'allowed' : 'refused'}`, () => {
        expect(canTransition(from, to)).toBe(ALLOWED.has(key));
      });
    }
  }
});
