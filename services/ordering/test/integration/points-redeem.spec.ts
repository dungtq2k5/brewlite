import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  CancelReason,
  LoyaltyKind,
  newId,
  OrderActorType,
  OrderStatus,
  Role,
} from '@brewlite/contracts';
import type { Caller } from '@brewlite/nest-common';
import { OrdersService } from '../../src/modules/orders/orders.service.js';
import { OrdersExpireJob } from '../../src/jobs/orders-expire.job.js';
import {
  buildCatalogStockStub,
  buildOrdersApp,
  pricedLine,
  readError,
} from './support/place-order.js';
import { prisma } from '../setup/per-file.js';

// ADR 0035 — points are spent after the promotion, come back whole on every cancel, and a
// reversal never takes the balance below zero.

let price = 236_000; // one line at this price; each test sets what it needs
const catalogMenu = {
  priceItems: vi.fn().mockImplementation((request: { lines: { productId: string }[] }) => {
    const lines = request.lines.map((l) => pricedLine(l.productId, price));
    return Promise.resolve({ lines, subtotalVnd: String(price * lines.length) });
  }),
};

const caller = (userId: string): Caller => ({ kind: 'USER', userId, role: Role.CUSTOMER });
const items = () => [{ productId: newId(), size: 'S', toppingIds: [], qty: 1 }];
const place = (orders: OrdersService, userId: string, extra: Record<string, unknown> = {}) =>
  orders.placeOrder(
    { items: items(), promoCode: undefined, note: undefined, idempotencyKey: newId(), ...extra },
    caller(userId),
  );

/** A balance the honest way: an earlier order and its EARN row, so the ledger sums to it. */
async function giveBalance(userId: string, points: number) {
  const order = await prisma.order.create({
    data: {
      id: newId(),
      userId,
      status: OrderStatus.COMPLETED,
      subtotalVnd: 100_000,
      totalVnd: 100_000,
      idempotencyKey: newId(),
      requestHash: 'x'.repeat(64),
      expiresAt: new Date(Date.now() + 900_000),
    },
  });
  await prisma.loyaltyTransaction.create({
    data: { id: newId(), userId, orderId: order.id, kind: LoyaltyKind.EARN, points },
  });
  await prisma.loyaltyAccount.upsert({
    where: { userId },
    create: { userId, balance: points, lifetimeEarned: points },
    update: { balance: { increment: points }, lifetimeEarned: { increment: points } },
  });
}

const balance = async (userId: string) =>
  (await prisma.loyaltyAccount.findUnique({ where: { userId } }))?.balance ?? 0;
const rows = (orderId: string) =>
  prisma.loyaltyTransaction.findMany({ where: { orderId }, orderBy: { id: 'asc' } });
async function ledgerMatches(userId: string) {
  const sum = await prisma.loyaltyTransaction.aggregate({
    where: { userId },
    _sum: { points: true },
  });
  return (await balance(userId)) === (sum._sum.points ?? 0);
}

describe('points — quote, place and every cancel path (real DB, catalog stubbed)', () => {
  let app: Awaited<ReturnType<typeof buildOrdersApp>>;
  let orders: OrdersService;

  beforeAll(async () => {
    app = await buildOrdersApp(catalogMenu, buildCatalogStockStub());
    orders = app.get(OrdersService);
  });
  afterAll(async () => {
    await app.close();
  });

  async function pay(orderId: string) {
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    await orders.applyPaymentSucceeded({
      paymentId: newId(),
      orderId,
      userId: order.userId,
      amountVnd: order.totalVnd,
      method: 'CARD',
    } as never);
  }
  const staffCancel = (orderId: string) =>
    prisma.$transaction((tx) =>
      orders.transition(
        tx,
        orderId,
        { status: OrderStatus.PAID },
        OrderStatus.CANCELLED,
        { type: OrderActorType.STAFF, userId: newId() },
        { cancelReason: CancelReason.STAFF, cancelNote: 'Machine broken' },
      ),
    );

  describe('quote', () => {
    it('₫236,000 with 60 points spends all 60 (BALANCE)', async () => {
      const userId = newId();
      await giveBalance(userId, 60);
      price = 236_000;
      const q = await orders.quote({ items: items(), pointsToRedeem: 60 }, caller(userId));
      expect(q).toMatchObject({
        pointsRedeemed: 60,
        pointsDiscountVnd: 60_000,
        totalVnd: '176000',
        pointsEarnable: 17,
        pointsBalance: 60,
        pointsRedeemable: 60,
        pointsCapReason: 'BALANCE',
      });
    });

    it('asking more than half the subtotal is clipped (PERCENT)', async () => {
      const userId = newId();
      await giveBalance(userId, 300);
      price = 102_000;
      const q = await orders.quote({ items: items(), pointsToRedeem: 300 }, caller(userId));
      expect(q).toMatchObject({
        pointsRedeemed: 51,
        totalVnd: '51000',
        pointsCapReason: 'PERCENT',
      });
    });

    it('a promotion first, then points down to the ₫15,000 floor (FLOOR)', async () => {
      const userId = newId();
      await giveBalance(userId, 300);
      await prisma.promotion.create({
        data: {
          id: newId(),
          code: `PTS${Date.now().toString(36).toUpperCase()}`.slice(0, 20),
          discountType: 'PERCENT',
          discountValue: 10,
          startsAt: new Date(Date.now() - 86_400_000),
          endsAt: new Date(Date.now() + 86_400_000),
        },
      });
      const code = (await prisma.promotion.findFirstOrThrow({ orderBy: { createdAt: 'desc' } }))
        .code;
      price = 35_000;
      const q = await orders.quote(
        { items: items(), promoCode: code, pointsToRedeem: 300 },
        caller(userId),
      );
      expect(q).toMatchObject({
        promoDiscountVnd: 3_500,
        pointsRedeemed: 16,
        totalVnd: '15500',
        pointsCapReason: 'FLOOR',
      });
    });

    it('without pointsToRedeem nothing is applied, but the cap and reason still come back', async () => {
      const userId = newId();
      await giveBalance(userId, 60);
      price = 236_000;
      const q = await orders.quote({ items: items() }, caller(userId));
      expect(q).toMatchObject({
        pointsRedeemed: 0,
        pointsDiscountVnd: 0,
        pointsRedeemable: 60,
        pointsCapReason: 'BALANCE',
        totalVnd: '236000',
      });
    });
  });

  describe('place', () => {
    it('spends the points: one REDEEM row, the balance down, the order carries them', async () => {
      const userId = newId();
      await giveBalance(userId, 60);
      price = 236_000;
      const { order } = await place(orders, userId, { pointsToRedeem: 60 });
      expect(order).toMatchObject({
        pointsRedeemed: 60,
        pointsDiscountVnd: 60_000,
        totalVnd: '176000',
      });
      expect(await balance(userId)).toBe(0);
      expect((await rows(order!.id)).map((r) => [r.kind, r.points])).toEqual([
        [LoyaltyKind.REDEEM, -60],
      ]);
      expect(await ledgerMatches(userId)).toBe(true);
    });

    it('asking more than the balance is POINTS_INSUFFICIENT with the balance, and writes nothing', async () => {
      const userId = newId();
      await giveBalance(userId, 20);
      price = 236_000;
      const error = await place(orders, userId, { pointsToRedeem: 21 }).catch((e: unknown) => e);
      expect(readError(error)).toEqual({ code: 'POINTS_INSUFFICIENT', details: { balance: 20 } });
      expect(await prisma.order.count({ where: { userId, status: OrderStatus.PENDING } })).toBe(0);
      expect(await balance(userId)).toBe(20);
    });

    it('two concurrent placements each spending the whole balance — exactly one wins, the balance never goes negative', async () => {
      const userId = newId();
      await giveBalance(userId, 40);
      price = 236_000;
      const results = await Promise.allSettled([
        place(orders, userId, { pointsToRedeem: 40 }),
        place(orders, userId, { pointsToRedeem: 40 }),
      ]);
      const won = results.filter((r) => r.status === 'fulfilled');
      const lost = results.filter((r) => r.status === 'rejected');
      expect(won).toHaveLength(1);
      expect(lost).toHaveLength(1);
      expect(readError((lost[0] as PromiseRejectedResult).reason).code).toBe('POINTS_INSUFFICIENT');
      expect(await balance(userId)).toBe(0);
      expect(await ledgerMatches(userId)).toBe(true);
    });

    it('the idempotency hash covers pointsToRedeem: a replay never spends twice; other points are a reuse', async () => {
      const userId = newId();
      await giveBalance(userId, 50);
      price = 236_000;
      const same = { idempotencyKey: newId(), items: items() };
      const first = await place(orders, userId, { ...same, pointsToRedeem: 30 });
      const replay = await place(orders, userId, { ...same, pointsToRedeem: 30 });
      expect(replay.created).toBe(false);
      expect(replay.order!.id).toBe(first.order!.id);
      expect(await balance(userId)).toBe(20);
      const reused = await place(orders, userId, { ...same, pointsToRedeem: 10 }).catch(
        (e: unknown) => e,
      );
      expect(readError(reused).code).toBe('IDEMPOTENCY_KEY_REUSED');
    });
  });

  describe('cancel', () => {
    it('by the customer: REDEEM_RETURNED +60, once; the balance back', async () => {
      const userId = newId();
      await giveBalance(userId, 60);
      price = 236_000;
      const { order } = await place(orders, userId, { pointsToRedeem: 60 });
      await orders.cancelOrder({ id: order!.id }, caller(userId));
      expect(await balance(userId)).toBe(60);
      expect((await rows(order!.id)).map((r) => [r.kind, r.points])).toEqual([
        [LoyaltyKind.REDEEM, -60],
        [LoyaltyKind.REDEEM_RETURNED, 60],
      ]);
    });

    it('by expiry: the points come back', async () => {
      const userId = newId();
      await giveBalance(userId, 60);
      price = 236_000;
      const { order } = await place(orders, userId, { pointsToRedeem: 60 });
      await prisma.order.update({
        where: { id: order!.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await app.get(OrdersExpireJob).run();
      const after = await prisma.order.findUniqueOrThrow({ where: { id: order!.id } });
      expect(after.status).toBe(OrderStatus.CANCELLED);
      expect(await balance(userId)).toBe(60);
    });

    it('by staff after paying: the points come back and the total (what is refunded) is unchanged', async () => {
      const userId = newId();
      await giveBalance(userId, 60);
      price = 236_000;
      const { order } = await place(orders, userId, { pointsToRedeem: 60 });
      await pay(order!.id);
      expect(await balance(userId)).toBe(17); // 60 − 60 + 17 earned on ₫176,000
      await staffCancel(order!.id);
      const after = await prisma.order.findUniqueOrThrow({ where: { id: order!.id } });
      expect(after.totalVnd).toBe(176_000);
      expect(await balance(userId)).toBe(60); // +60 returned, −17 reversed
      expect(await ledgerMatches(userId)).toBe(true);
    });

    it('the reversal is clipped: earned 17, spent 10 elsewhere — EARN_REVERSED −7 and a zero balance', async () => {
      const userId = newId();
      price = 176_000;
      const { order: earning } = await place(orders, userId);
      await pay(earning!.id);
      expect(await balance(userId)).toBe(17);
      price = 50_000;
      await place(orders, userId, { pointsToRedeem: 10 });
      expect(await balance(userId)).toBe(7);

      await staffCancel(earning!.id);
      const reversed = (await rows(earning!.id)).find((r) => r.kind === LoyaltyKind.EARN_REVERSED);
      expect(reversed?.points).toBe(-7);
      expect(await balance(userId)).toBe(0);
      expect(await ledgerMatches(userId)).toBe(true);
    });

    it('all spent: nothing left to reverse — no EARN_REVERSED row at all', async () => {
      const userId = newId();
      price = 176_000;
      const { order: earning } = await place(orders, userId);
      await pay(earning!.id);
      price = 50_000;
      await place(orders, userId, { pointsToRedeem: 17 });
      expect(await balance(userId)).toBe(0);

      await staffCancel(earning!.id);
      expect((await rows(earning!.id)).some((r) => r.kind === LoyaltyKind.EARN_REVERSED)).toBe(
        false,
      );
      expect(await balance(userId)).toBe(0);
    });

    it('return comes before reverse — the returned points cover the reversal', async () => {
      const userId = newId();
      await giveBalance(userId, 60);
      price = 236_000;
      const { order } = await place(orders, userId, { pointsToRedeem: 60 }); // total ₫176,000
      await pay(order!.id); // +17 → 17
      price = 50_000;
      await place(orders, userId, { pointsToRedeem: 10 }); // → 7

      await staffCancel(order!.id);
      // Return first: 7 + 60 = 67, then the whole 17 reversed → 50. (Reverse first would remove only 7.)
      const reversed = (await rows(order!.id)).find((r) => r.kind === LoyaltyKind.EARN_REVERSED);
      expect(reversed?.points).toBe(-17);
      expect(await balance(userId)).toBe(50);
      expect(await ledgerMatches(userId)).toBe(true);
    });
  });
});
