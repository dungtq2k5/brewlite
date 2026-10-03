import { describe, expect, it } from 'vitest';
import { OrderStatus } from '@brewlite/contracts';
import { assertTransition } from './order-lifecycle.js';

describe('assertTransition', () => {
  it('does not throw for a legal transition', () => {
    expect(() => assertTransition(OrderStatus.PENDING, OrderStatus.PAID)).not.toThrow();
  });

  it('throws for an illegal transition', () => {
    expect(() => assertTransition(OrderStatus.CANCELLED, OrderStatus.PENDING)).toThrow();
  });

  it('throws for a transition out of a terminal status', () => {
    expect(() => assertTransition(OrderStatus.COMPLETED, OrderStatus.CANCELLED)).toThrow();
  });
});
