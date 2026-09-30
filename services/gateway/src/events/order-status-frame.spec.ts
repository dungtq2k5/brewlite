import { describe, expect, it } from 'vitest';
import { newId, OrderActorType, OrderStatus } from '@brewlite/contracts';
import { formatFrame, toFrame } from './order-status-frame.js';

const payload = (orderNo: string) => ({
  eventId: newId(),
  occurredAt: '2026-09-30T08:15:02.120Z',
  orderId: newId(),
  orderNo,
  userId: newId(),
  from: OrderStatus.PAID,
  to: OrderStatus.PREPARING,
  actorType: OrderActorType.STAFF,
});

describe('toFrame', () => {
  it('turns the int64 string orderNo into a JSON number and exposes only the status', () => {
    const p = payload('1042');
    const frame = toFrame(p);
    expect(frame).toEqual({
      id: p.eventId,
      orderId: p.orderId,
      orderNo: 1042,
      status: 'PREPARING',
      at: p.occurredAt,
    });
    expect(formatFrame(frame)).not.toContain(p.userId);
  });

  it('throws for an orderNo past MAX_SAFE_INTEGER', () => {
    expect(() => toFrame(payload('9007199254740993'))).toThrow();
  });
});
