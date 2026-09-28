import { describe, expect, it } from 'vitest';
import { OrderStatus, ORDER_STATUSES, STAFF_BOARD_STATUSES, parseEnum } from './enums.js';

describe('parseEnum', () => {
  it('returns a known value typed', () => {
    expect(parseEnum(OrderStatus, 'PAID')).toBe(OrderStatus.PAID);
  });

  it('throws a plain Error naming the enum and the value for an unknown value', () => {
    expect(() => parseEnum(OrderStatus, 'ORDER_STATUS_UNSPECIFIED')).toThrow(
      /ORDER_STATUS_UNSPECIFIED/,
    );
  });
});

describe('STAFF_BOARD_STATUSES', () => {
  it('is a subset of ORDER_STATUSES', () => {
    for (const status of STAFF_BOARD_STATUSES) {
      expect(ORDER_STATUSES).toContain(status);
    }
    expect(STAFF_BOARD_STATUSES).toEqual([
      OrderStatus.PAID,
      OrderStatus.PREPARING,
      OrderStatus.READY,
    ]);
  });
});
