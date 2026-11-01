import { describe, expect, it } from 'vitest';
import {
  clearOverlays,
  columnOf,
  isRelevantFrame,
  newOrderIds,
  nextMove,
  pendingMove,
  placeOrders,
  type BoardOrder,
  type Overlay,
} from './board';

const order = (
  id: string,
  status: string,
  paidAt: string | null = '2026-10-31T05:00:00Z',
): BoardOrder => ({
  id,
  status,
  paidAt,
});

describe('nextMove', () => {
  it('goes Paid → Preparing → Ready → Completed, and nowhere from anything else', () => {
    expect(nextMove('PAID')).toBe('PREPARING');
    expect(nextMove('PREPARING')).toBe('READY');
    expect(nextMove('READY')).toBe('COMPLETED');
    expect(nextMove('CANCELLED')).toBeNull();
  });
});

describe('columnOf', () => {
  it('is the server status without an overlay', () => {
    expect(columnOf(order('a', 'PAID'), undefined)).toBe('PAID');
    expect(columnOf(order('a', 'READY'), undefined)).toBe('READY');
  });

  it.each<[string, Overlay, string | null]>([
    ['inFlight', { kind: 'inFlight', to: 'PREPARING' }, 'PREPARING'],
    ['pending', { kind: 'pending', to: 'READY', sendAt: 1 }, 'READY'],
    ['a pending Collected', { kind: 'pending', to: 'COMPLETED', sendAt: 1 }, null],
    ['an in-flight Collected', { kind: 'inFlight', to: 'COMPLETED' }, null],
  ])('%s: the overlay decides', (_name, overlay, expected) => {
    expect(columnOf(order('a', 'PAID'), overlay)).toBe(expected);
  });

  it('a moved-elsewhere line leaves the card in its real column', () => {
    expect(columnOf(order('a', 'READY'), { kind: 'moved', until: 9 })).toBe('READY');
  });

  it('is nowhere for a status the board does not show', () => {
    expect(columnOf(order('a', 'COMPLETED'), undefined)).toBeNull();
  });
});

describe('placeOrders', () => {
  it('fills three columns, oldest first, with overlays applied', () => {
    const orders = [
      order('c', 'PAID', '2026-10-31T05:03:00Z'),
      order('a', 'PAID', '2026-10-31T05:01:00Z'),
      order('b', 'PREPARING', '2026-10-31T05:02:00Z'),
      order('d', 'READY', '2026-10-31T05:00:00Z'),
    ];
    const overlays = new Map<string, Overlay>([['a', { kind: 'inFlight', to: 'PREPARING' }]]);
    const columns = placeOrders(orders, overlays);
    expect(columns.PAID.map((o) => o.id)).toEqual(['c']);
    expect(columns.PREPARING.map((o) => o.id)).toEqual(['a', 'b']);
    expect(columns.READY.map((o) => o.id)).toEqual(['d']);
  });

  it('breaks a tie on paidAt by id, so two tablets order alike', () => {
    const columns = placeOrders([order('b', 'PAID'), order('a', 'PAID')], new Map());
    expect(columns.PAID.map((o) => o.id)).toEqual(['a', 'b']);
  });
});

describe('clearOverlays', () => {
  const now = 1_000;

  it('drops an in-flight move once the server agrees, keeps it until then', () => {
    const overlays = new Map<string, Overlay>([['a', { kind: 'inFlight', to: 'PREPARING' }]]);
    expect(clearOverlays(overlays, [order('a', 'PAID')], now).has('a')).toBe(true);
    expect(clearOverlays(overlays, [order('a', 'PREPARING')], now).has('a')).toBe(false);
  });

  it('drops an in-flight Collected when the order leaves the board', () => {
    const overlays = new Map<string, Overlay>([['a', { kind: 'inFlight', to: 'COMPLETED' }]]);
    expect(clearOverlays(overlays, [order('a', 'READY')], now).has('a')).toBe(true);
    expect(clearOverlays(overlays, [], now).has('a')).toBe(false);
  });

  it('never drops a pending move — it has not been sent', () => {
    const overlays = new Map<string, Overlay>([
      ['a', { kind: 'pending', to: 'READY', sendAt: 5_000 }],
    ]);
    expect(clearOverlays(overlays, [order('a', 'PREPARING')], now).has('a')).toBe(true);
  });

  it('expires the moved-elsewhere line after its time', () => {
    const overlays = new Map<string, Overlay>([['a', { kind: 'moved', until: 2_000 }]]);
    expect(clearOverlays(overlays, [order('a', 'READY')], 1_999).has('a')).toBe(true);
    expect(clearOverlays(overlays, [order('a', 'READY')], 2_000).has('a')).toBe(false);
  });
});

describe('pendingMove', () => {
  it('finds the one move waiting out its undo window', () => {
    const overlays = new Map<string, Overlay>([
      ['a', { kind: 'inFlight', to: 'PREPARING' }],
      ['b', { kind: 'pending', to: 'READY', sendAt: 7 }],
    ]);
    expect(pendingMove(overlays)).toEqual({ id: 'b', to: 'READY', sendAt: 7 });
    expect(pendingMove(new Map())).toBeUndefined();
  });
});

describe('newOrderIds', () => {
  it('the first data has none', () => {
    expect(newOrderIds(null, [order('a', 'PAID')])).toEqual([]);
  });

  it('a PAID id the board did not hold is new', () => {
    expect(newOrderIds([order('a', 'PAID')], [order('a', 'PAID'), order('b', 'PAID')])).toEqual([
      'b',
    ]);
  });

  it('an order moving PAID → PREPARING is not new, nor is one arriving already started', () => {
    expect(newOrderIds([order('a', 'PAID')], [order('a', 'PREPARING')])).toEqual([]);
    expect(newOrderIds([], [order('x', 'PREPARING')])).toEqual([]);
  });
});

describe('isRelevantFrame', () => {
  const onBoard = new Set(['a']);

  it.each(['PAID', 'PREPARING', 'READY'])('a frame into %s matters', (status) => {
    expect(isRelevantFrame({ orderId: 'z', status }, onBoard)).toBe(true);
  });

  it('a frame about an order on the board matters when it leaves', () => {
    expect(isRelevantFrame({ orderId: 'a', status: 'COMPLETED' }, onBoard)).toBe(true);
    expect(isRelevantFrame({ orderId: 'a', status: 'CANCELLED' }, onBoard)).toBe(true);
  });

  it('a customer placing or paying elsewhere does not', () => {
    expect(isRelevantFrame({ orderId: 'z', status: 'PENDING' }, onBoard)).toBe(false);
    expect(isRelevantFrame({ orderId: 'z', status: 'PAYMENT_FAILED' }, onBoard)).toBe(false);
    expect(isRelevantFrame({ orderId: 'z', status: 'CANCELLED' }, onBoard)).toBe(false);
  });
});
