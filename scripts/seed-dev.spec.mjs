import { describe, expect, it } from 'vitest';
import {
  DEMO_CUSTOMERS,
  businessDay,
  makeRng,
  offsetMs,
  orderingShiftSql,
  paymentShiftSql,
  pickHour,
  planDemo,
  readEnvText,
  shiftDay,
  summarize,
  vietnamTime,
} from './seed-dev-lib.mjs';

const NOW = new Date('2026-11-10T09:30:00Z'); // 16:30 on 10 Nov in Vietnam

describe('makeRng', () => {
  it('makes the same sequence from the same seed, and a different one from another', () => {
    const a = makeRng(2026);
    const b = makeRng(2026);
    const first = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(first);
    expect(Array.from({ length: 5 }, () => makeRng(7).next())).not.toEqual(first);
  });
  it('stays inside its ranges', () => {
    const rng = makeRng(1);
    for (let i = 0; i < 500; i++) {
      const n = rng.next();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
      expect(rng.int(7)).toBeLessThan(7);
    }
  });
});

describe('readEnvText', () => {
  it('reads KEY=value lines, skipping comments and blanks, and unquotes values', () => {
    const env = readEnvText('# a comment\n\nA=1\nB="two words"\nC = three \nD=x=y\nnot a line\n');
    expect(env).toEqual({ A: '1', B: 'two words', C: 'three', D: 'x=y' });
  });
  it('drops an inline comment from an unquoted value, but not from a quoted one', () => {
    const env = readEnvText('A=fake # for demo\nB="a # b"\nC=x#y\n');
    expect(env).toEqual({ A: 'fake', B: 'a # b', C: 'x#y' });
  });
  it('accepts Windows line endings', () => {
    expect(readEnvText('A=1\r\nB=2\r\n')).toEqual({ A: '1', B: '2' });
  });
});

describe('days and times', () => {
  it('reads the business day in Vietnam, not UTC', () => {
    expect(businessDay(new Date('2026-11-09T18:00:00Z'))).toBe('2026-11-10'); // 01:00 there
    expect(businessDay(new Date('2026-11-10T16:59:00Z'))).toBe('2026-11-10');
    expect(businessDay(new Date('2026-11-10T17:00:00Z'))).toBe('2026-11-11');
  });
  it('shifts days across month and year ends', () => {
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDay('2027-01-01', -1)).toBe('2026-12-31');
  });
  it('turns a Vietnam clock time into the instant', () => {
    expect(vietnamTime('2026-11-10', 7, 5).toISOString()).toBe('2026-11-10T00:05:00.000Z');
  });
  it('picks opening hours only', () => {
    const rng = makeRng(3);
    for (let i = 0; i < 300; i++) {
      const hour = pickHour(rng);
      expect(hour).toBeGreaterThanOrEqual(7);
      expect(hour).toBeLessThanOrEqual(20);
    }
  });
});

describe('planDemo', () => {
  const plan = planDemo({ now: NOW });
  it('is the same plan every time', () => {
    expect(planDemo({ now: NOW })).toEqual(plan);
  });
  it('has the café the doc promises', () => {
    expect(summarize(plan)).toMatchObject({
      total: 72,
      live: 5,
      staffCancelled: 3,
      customerCancelled: 4,
      days: 30,
    });
    const live = plan.orders.filter((o) => o.kind.startsWith('live-')).map((o) => o.kind);
    expect(live.sort()).toEqual([
      'live-PAID',
      'live-PAID',
      'live-PREPARING',
      'live-PREPARING',
      'live-READY',
    ]);
  });
  it('leaves today where the API put it and moves every older order to a Vietnam opening hour', () => {
    for (const o of plan.orders) {
      if (o.daysAgo === 0) expect(o.target).toBeNull();
      else {
        const hour = (o.target.getUTCHours() + 7) % 24;
        expect(hour).toBeGreaterThanOrEqual(7);
        expect(hour).toBeLessThanOrEqual(20);
        expect(businessDay(o.target)).toBe(shiftDay('2026-11-10', -o.daysAgo));
      }
    }
  });
  it('sells on every one of the last 30 days', () => {
    const completed = new Set(
      plan.orders.filter((o) => o.kind === 'COMPLETED').map((o) => o.daysAgo),
    );
    for (let day = 0; day <= 29; day++) expect(completed.has(day)).toBe(true);
  });
  it('gives WELCOME10 once per customer and COFFEE20K to three different customers', () => {
    const welcome = plan.orders.filter((o) => o.promo === 'WELCOME10').map((o) => o.customer);
    expect(new Set(welcome).size).toBe(welcome.length);
    expect(welcome).toHaveLength(DEMO_CUSTOMERS.length);
    const coffee = plan.orders.filter((o) => o.promo === 'COFFEE20K');
    expect(coffee).toHaveLength(3);
    expect(new Set(coffee.map((o) => o.customer)).size).toBe(3);
    expect(coffee.every((o) => o.kind === 'COMPLETED' && o.minSubtotal >= 50_000)).toBe(true);
  });
  it('queues each customer’s orders oldest first, so ids and dates agree', () => {
    for (const queue of plan.queues) {
      const days = queue.map((o) => o.daysAgo);
      expect(days).toEqual([...days].sort((a, b) => b - a));
    }
  });
  it('spreads the live orders over five different customers', () => {
    const owners = plan.orders.filter((o) => o.kind.startsWith('live-')).map((o) => o.customer);
    expect(new Set(owners).size).toBe(5);
  });
});

describe('the time shift', () => {
  const id = '01a1883c-9bd1-718a-ab11-6e33d9e59723';
  it('is how far back the order must go, never forward', () => {
    expect(offsetMs(new Date('2026-11-10T10:00:00Z'), new Date('2026-11-09T10:00:00Z'))).toBe(
      86_400_000,
    );
    expect(offsetMs(new Date('2026-11-10T10:00:00Z'), new Date('2026-11-11T10:00:00Z'))).toBe(0);
  });
  it('moves every timestamp of an order by the same amount, in one transaction', () => {
    const sql = orderingShiftSql([{ orderId: id, ms: 3_600_000 }]);
    expect(sql.startsWith('BEGIN;')).toBe(true);
    expect(sql.trimEnd().endsWith('COMMIT;')).toBe(true);
    for (const column of ['created_at', 'updated_at', 'paid_at', 'cancelled_at', 'expires_at']) {
      expect(sql).toContain(`${column} = o.${column} - make_interval`);
    }
    expect(sql).toContain('UPDATE order_status_history');
    expect(sql).toContain('UPDATE loyalty_transactions');
    expect(sql).toContain(`('${id}', 3600000)`);
  });
  it('does the same for payments and refunds', () => {
    const sql = paymentShiftSql([{ orderId: id, ms: 1 }]);
    expect(sql).toContain('UPDATE payments');
    expect(sql).toContain('UPDATE refunds');
    expect(sql).toContain('succeeded_at');
  });
  it('writes nothing for nothing, and refuses anything that is not an id', () => {
    expect(orderingShiftSql([])).toBe('');
    expect(() => orderingShiftSql([{ orderId: "x'; DROP TABLE orders; --", ms: 1 }])).toThrow();
    expect(() => paymentShiftSql([{ orderId: id, ms: Number.NaN }])).toThrow();
  });
});
