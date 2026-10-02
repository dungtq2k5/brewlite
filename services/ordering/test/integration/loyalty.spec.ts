import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@brewlite/contracts';
import { envSchema } from '../../src/config/env.schema.js';
import { LoyaltyModule } from '../../src/modules/loyalty/loyalty.module.js';
import { LoyaltyService } from '../../src/modules/loyalty/loyalty.service.js';
import { PrismaModule } from '../../src/modules/prisma/prisma.module.js';
import { prisma } from '../setup/per-file.js';
import { testEnv } from '../setup/env.js';

async function buildModule() {
  const configModule = ConfigModule.forRoot({
    isGlobal: true,
    validate: () =>
      envSchema.parse({
        ...testEnv,
        DATABASE_URL: testEnv.DATABASE_URL_TEST,
      }),
  });
  const moduleRef = await Test.createTestingModule({
    imports: [configModule, PrismaModule, LoyaltyModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

async function seedOrder(userId: string, totalVnd: number) {
  return prisma.order.create({
    data: {
      id: newId(),
      userId,
      subtotalVnd: totalVnd,
      totalVnd,
      idempotencyKey: newId(),
      requestHash: 'x'.repeat(64),
      expiresAt: new Date(Date.now() + 900_000),
    },
  });
}

async function balanceInvariantHolds(userId: string): Promise<boolean> {
  const [account, sum] = await Promise.all([
    prisma.loyaltyAccount.findUnique({ where: { userId } }),
    prisma.loyaltyTransaction.aggregate({ where: { userId }, _sum: { points: true } }),
  ]);
  return (account?.balance ?? 0) === (sum._sum.points ?? 0);
}

describe('LoyaltyService — real DB', () => {
  let app: Awaited<ReturnType<typeof buildModule>>;
  let loyalty: LoyaltyService;

  beforeAll(async () => {
    app = await buildModule();
    loyalty = app.get(LoyaltyService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('earn, a duplicate earn, then reverse — the balance always equals the ledger sum', async () => {
    const userId = newId();
    const order = await seedOrder(userId, 52_200);

    await prisma.$transaction((tx) => loyalty.earn(tx, order));
    expect(await balanceInvariantHolds(userId)).toBe(true);
    let account = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId } });
    expect(account.balance).toBe(5);
    expect(account.lifetimeEarned).toBe(5);

    // A redelivered PAID event earns once.
    await prisma.$transaction((tx) => loyalty.earn(tx, order));
    account = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId } });
    expect(account.balance).toBe(5);
    expect(await balanceInvariantHolds(userId)).toBe(true);

    await prisma.$transaction((tx) => loyalty.reverse(tx, order));
    account = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId } });
    expect(account.balance).toBe(0);
    expect(account.lifetimeEarned).toBe(5); // never reduced
    expect(await balanceInvariantHolds(userId)).toBe(true);

    const updatedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updatedOrder.pointsEarned).toBe(5);
  });

  it('GetMyLoyalty for a customer with no ledger returns zeros and an empty list', async () => {
    const response = await loyalty.getMyLoyalty(newId());
    expect(response).toEqual({ balance: 0, lifetimeEarned: 0, recent: [] });
  });

  it('GetMyLoyalty lists the 20 most recent rows with the order number joined', async () => {
    const userId = newId();
    const order = await seedOrder(userId, 52_200);
    await prisma.$transaction((tx) => loyalty.earn(tx, order));

    const response = await loyalty.getMyLoyalty(userId);
    expect(response.balance).toBe(5);
    expect(response.recent).toHaveLength(1);
    expect(response.recent[0]).toMatchObject({
      orderId: order.id,
      orderNo: order.orderNo.toString(),
      kind: 'EARN',
      points: 5,
    });
  });
});
