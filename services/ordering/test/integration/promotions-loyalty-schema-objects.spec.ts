import { describe, expect, it } from 'vitest';
import { newId } from '@brewlite/contracts';
import { prisma } from '../setup/per-file.js';

function promotion(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: newId(),
    code: 'WELCOME10',
    discountType: 'PERCENT',
    discountValue: 10,
    startsAt: new Date(),
    endsAt: new Date(Date.now() + 86_400_000),
    ...overrides,
  };
}

async function seedOrder(overrides: Partial<Record<string, unknown>> = {}) {
  return prisma.order.create({
    data: {
      id: newId(),
      userId: newId(),
      subtotalVnd: 20_000,
      totalVnd: 20_000,
      idempotencyKey: newId(),
      requestHash: 'x'.repeat(64),
      expiresAt: new Date(Date.now() + 900_000),
      ...overrides,
    },
  });
}

describe('promotions O-4 schema objects', () => {
  it('refuses a code that is not upper-case', async () => {
    await expect(
      prisma.promotion.create({ data: promotion({ code: 'welcome10' }) }),
    ).rejects.toThrow();
  });

  it('refuses a PERCENT discount over 100', async () => {
    await expect(
      prisma.promotion.create({ data: promotion({ discountValue: 101 }) }),
    ).rejects.toThrow();
  });

  it('refuses a FIXED discount of 0', async () => {
    await expect(
      prisma.promotion.create({ data: promotion({ discountType: 'FIXED', discountValue: 0 }) }),
    ).rejects.toThrow();
  });

  it('refuses a cap on a FIXED discount', async () => {
    await expect(
      prisma.promotion.create({
        data: promotion({ discountType: 'FIXED', discountValue: 15_000, maxDiscountVnd: 5_000 }),
      }),
    ).rejects.toThrow();
  });

  it('refuses an end date at or before the start date', async () => {
    const now = new Date();
    await expect(
      prisma.promotion.create({ data: promotion({ startsAt: now, endsAt: now }) }),
    ).rejects.toThrow();
  });

  it('refuses used_count above max_uses', async () => {
    await expect(
      prisma.promotion.create({ data: promotion({ maxUses: 1, usedCount: 2 }) }),
    ).rejects.toThrow();
  });

  it('refuses deleted_at without deleted_by_id', async () => {
    const row = await prisma.promotion.create({ data: promotion() });
    await expect(
      prisma.promotion.update({ where: { id: row.id }, data: { deletedAt: new Date() } }),
    ).rejects.toThrow();
  });

  it('the FK refuses an order naming an unknown promotion_id', async () => {
    await expect(seedOrder({ promotionId: newId(), promoCode: 'WELCOME10' })).rejects.toThrow();
  });
});

describe('loyalty O-5/O-6 schema objects', () => {
  it('refuses a negative balance', async () => {
    await expect(
      prisma.loyaltyAccount.create({ data: { userId: newId(), balance: -1 } }),
    ).rejects.toThrow();
  });

  it('refuses a zero-point transaction', async () => {
    const order = await seedOrder();
    await expect(
      prisma.loyaltyTransaction.create({
        data: { id: newId(), userId: order.userId, orderId: order.id, kind: 'EARN', points: 0 },
      }),
    ).rejects.toThrow();
  });

  it('the FK refuses an unknown order_id', async () => {
    await expect(
      prisma.loyaltyTransaction.create({
        data: { id: newId(), userId: newId(), orderId: newId(), kind: 'EARN', points: 5 },
      }),
    ).rejects.toThrow();
  });

  it('refuses a second row of the same kind for the same order', async () => {
    const order = await seedOrder();
    await prisma.loyaltyTransaction.create({
      data: { id: newId(), userId: order.userId, orderId: order.id, kind: 'EARN', points: 5 },
    });
    await expect(
      prisma.loyaltyTransaction.create({
        data: { id: newId(), userId: order.userId, orderId: order.id, kind: 'EARN', points: 5 },
      }),
    ).rejects.toThrow();
  });
});
