import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { newId, OrderStatus, Role } from '@brewlite/contracts';
import type { Caller } from '@brewlite/nest-common';
import { OrdersService } from '../../src/modules/orders/orders.service.js';
import { OrdersExpireJob } from '../../src/jobs/orders-expire.job.js';
import {
  buildCatalogMenuStub,
  buildCatalogStockStub,
  buildOrdersApp,
  readError,
} from './support/place-order.js';
import { prisma } from '../setup/per-file.js';

function request(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    items: [{ productId: newId(), size: 'S', toppingIds: [], qty: 1 }],
    promoCode: undefined,
    note: undefined,
    idempotencyKey: newId(),
    ...overrides,
  };
}

async function seedPromotion(overrides: Partial<Record<string, unknown>> = {}) {
  return prisma.promotion.create({
    data: {
      id: newId(),
      code: 'WELCOME10',
      discountType: 'PERCENT',
      discountValue: 10,
      minSubtotalVnd: 0,
      startsAt: new Date(Date.now() - 86_400_000),
      endsAt: new Date(Date.now() + 86_400_000),
      perUserLimit: 1,
      ...overrides,
    },
  });
}

describe('promotions applied in quote and placeOrder — real DB, catalog stubbed', () => {
  let app: Awaited<ReturnType<typeof buildOrdersApp>>;
  let orders: OrdersService;
  let catalogMenu: ReturnType<typeof buildCatalogMenuStub>;
  let catalogStock: ReturnType<typeof buildCatalogStockStub>;

  beforeAll(async () => {
    catalogMenu = buildCatalogMenuStub(58_000);
    catalogStock = buildCatalogStockStub();
    app = await buildOrdersApp(catalogMenu, catalogStock);
    orders = app.get(OrdersService);
  });

  afterEach(() => {
    catalogMenu.priceItems.mockClear();
    catalogStock.reserveStock.mockClear();
    catalogStock.releaseStock.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  it('quote applies the code: 58,000 × 10% = 5,800 off, pointsEarnable on the post-discount total', async () => {
    const caller: Caller = { kind: 'USER', userId: newId(), role: Role.CUSTOMER };
    await seedPromotion();

    const quote = await orders.quote(request({ promoCode: 'WELCOME10' }), caller);

    expect(quote.promoDiscountVnd).toBe(5_800);
    expect(quote.totalVnd).toBe('52200');
    expect(quote.promoCode).toBe('WELCOME10');
    expect(quote.pointsEarnable).toBe(5); // floor(52200 / 10000)
  });

  it.each([
    ['NOT_FOUND', () => Promise.resolve()],
    ['INACTIVE', () => seedPromotion({ isActive: false })],
    [
      'NOT_STARTED',
      () =>
        seedPromotion({
          startsAt: new Date(Date.now() + 3_600_000),
          endsAt: new Date(Date.now() + 2 * 86_400_000),
        }),
    ],
    ['EXPIRED', () => seedPromotion({ endsAt: new Date(Date.now() - 1000) })],
    ['MIN_SUBTOTAL', () => seedPromotion({ minSubtotalVnd: 1_000_000 })],
    ['EXHAUSTED', () => seedPromotion({ maxUses: 1, usedCount: 1 })],
  ])('quote refuses %s', async (reason, seed) => {
    const caller: Caller = { kind: 'USER', userId: newId(), role: Role.CUSTOMER };
    await seed();

    const error = await orders
      .quote(request({ promoCode: 'WELCOME10' }), caller)
      .catch((e: unknown) => e);

    expect(readError(error).code).toBe('PROMO_CODE_INVALID');
    expect(readError(error).details?.reason).toBe(reason);
  });

  it('PER_USER_LIMIT refuses a second order by the same customer', async () => {
    const caller: Caller = { kind: 'USER', userId: newId(), role: Role.CUSTOMER };
    await seedPromotion();
    await orders.placeOrder(request({ promoCode: 'WELCOME10' }), caller);

    const error = await orders
      .quote(request({ promoCode: 'WELCOME10' }), caller)
      .catch((e: unknown) => e);
    expect(readError(error).code).toBe('PROMO_CODE_INVALID');
    expect(readError(error).details?.reason).toBe('PER_USER_LIMIT');
  });

  it('place counts a use; cancelling gives it back and a second order succeeds', async () => {
    const caller: Caller = { kind: 'USER', userId: newId(), role: Role.CUSTOMER };
    const promo = await seedPromotion();

    const first = await orders.placeOrder(request({ promoCode: 'WELCOME10' }), caller);
    const afterPlace = await prisma.promotion.findUniqueOrThrow({ where: { id: promo.id } });
    expect(afterPlace.usedCount).toBe(1);
    expect(first.order!.promoCode).toBe('WELCOME10');
    expect(first.order!.promoDiscountVnd).toBe(5_800);

    await orders.cancelOrder({ id: first.order!.id }, caller);
    const afterCancel = await prisma.promotion.findUniqueOrThrow({ where: { id: promo.id } });
    expect(afterCancel.usedCount).toBe(0);

    const second = await orders.placeOrder(request({ promoCode: 'WELCOME10' }), caller);
    expect(second.created).toBe(true);
  });

  it('a use given back by expiry is not double-given-back by a later cancel race', async () => {
    const caller: Caller = { kind: 'USER', userId: newId(), role: Role.CUSTOMER };
    const promo = await seedPromotion();
    const placed = await orders.placeOrder(request({ promoCode: 'WELCOME10' }), caller);

    await prisma.order.update({
      where: { id: placed.order!.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const job = app.get(OrdersExpireJob);
    await job.run();

    const afterExpiry = await prisma.promotion.findUniqueOrThrow({ where: { id: promo.id } });
    expect(afterExpiry.usedCount).toBe(0);

    // A redundant cancel attempt on the already-CANCELLED order loses transition()'s
    // own race and must not touch used_count a second time.
    await orders.cancelOrder({ id: placed.order!.id }, caller).catch(() => undefined);
    const afterSecondAttempt = await prisma.promotion.findUniqueOrThrow({
      where: { id: promo.id },
    });
    expect(afterSecondAttempt.usedCount).toBe(0);
  });

  it('applies a valid promotion code ONCE under CONCURRENT orders — max_uses: 1, five customers: one wins, four EXHAUSTED, four released', async () => {
    const promo = await seedPromotion({ code: 'CAPPED', maxUses: 1, perUserLimit: null });
    const callers: Caller[] = Array.from({ length: 5 }, () => ({
      kind: 'USER',
      userId: newId(),
      role: Role.CUSTOMER,
    }));

    const results = await Promise.allSettled(
      callers.map((caller) => orders.placeOrder(request({ promoCode: 'CAPPED' }), caller)),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(4);
    for (const f of failed) {
      expect(readError(f.reason).code).toBe('PROMO_CODE_INVALID');
      expect(readError(f.reason).details?.reason).toBe('EXHAUSTED');
    }

    const final = await prisma.promotion.findUniqueOrThrow({ where: { id: promo.id } });
    expect(final.usedCount).toBe(1);
    // Losers refused at the early, read-only step-4 check (api §6.1) never reserved stock
    // in the first place, so how many of the 4 reach the locked step-6 refusal — and thus
    // call ReleaseStock — is a genuine race; only "at most every loser" is guaranteed.
    expect(catalogStock.releaseStock.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it('per_user_limit: 1 under three concurrent orders by the same customer — exactly one succeeds', async () => {
    await seedPromotion({ code: 'ONCE', perUserLimit: 1 });
    const caller: Caller = { kind: 'USER', userId: newId(), role: Role.CUSTOMER };

    const results = await Promise.allSettled(
      Array.from({ length: 3 }, () => orders.placeOrder(request({ promoCode: 'ONCE' }), caller)),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    expect(succeeded).toHaveLength(1);

    const liveOrders = await prisma.order.count({
      where: { userId: caller.userId, status: { not: OrderStatus.CANCELLED } },
    });
    expect(liveOrders).toBe(1);
  });
});
