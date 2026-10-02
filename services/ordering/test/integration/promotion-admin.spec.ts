import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Metadata } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compareStrings, newId, Role } from '@brewlite/contracts';
import type { Caller } from '@brewlite/nest-common';
import { envSchema } from '../../src/config/env.schema.js';
import { PromotionsModule } from '../../src/modules/promotions/promotions.module.js';
import { PromotionAdminService } from '../../src/modules/promotions/promotion-admin.service.js';
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
    imports: [configModule, PrismaModule, PromotionsModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

function errorCodeOf(exception: unknown): string | undefined {
  if (!(exception && typeof exception === 'object' && 'getError' in exception)) return undefined;
  const { metadata } = (exception as RpcException).getError() as { metadata: Metadata };
  return metadata.get('bl-error-code')[0] as string | undefined;
}

const caller: Caller = { kind: 'USER', userId: newId(), role: Role.ADMIN };

function createRequest(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    code: 'welcome10',
    discountType: 'PERCENT',
    discountValue: 10,
    minSubtotalVnd: 0,
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    perUserLimit: 1,
    ...overrides,
  };
}

describe('PromotionAdminService', () => {
  let app: Awaited<ReturnType<typeof buildModule>>;
  let promotions: PromotionAdminService;

  beforeAll(async () => {
    app = await buildModule();
    promotions = app.get(PromotionAdminService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a code, upper-cased', async () => {
    const { promotion } = await promotions.createPromotion(createRequest());
    expect(promotion!.code).toBe('WELCOME10');
  });

  it('a second code with the same value refuses PROMO_CODE_TAKEN', async () => {
    await promotions.createPromotion(createRequest({ code: 'TAKEN1' }));
    await expect(promotions.createPromotion(createRequest({ code: 'taken1' }))).rejects.toSatisfy(
      (e: unknown) => errorCodeOf(e) === 'PROMO_CODE_TAKEN',
    );
  });

  it('an out-of-range PERCENT discountValue is refused', async () => {
    await expect(
      promotions.createPromotion(createRequest({ code: 'BAD1', discountValue: 200 })),
    ).rejects.toSatisfy((e: unknown) => errorCodeOf(e) === 'VALIDATION_FAILED');
  });

  it('lowering maxUses below usedCount refuses PROMO_MAX_USES_BELOW_USED', async () => {
    const { promotion } = await promotions.createPromotion(createRequest({ code: 'CAPPED1' }));
    await prisma.promotion.update({ where: { id: promotion!.id }, data: { usedCount: 2 } });

    await expect(promotions.updatePromotion({ id: promotion!.id, maxUses: 1 })).rejects.toSatisfy(
      (e: unknown) => errorCodeOf(e) === 'PROMO_MAX_USES_BELOW_USED',
    );

    const { promotion: unchanged } = await promotions.getPromotion({ id: promotion!.id });
    expect(unchanged!.maxUses).toBeUndefined();
  });

  it('the discount itself is not editable — no such field on update', async () => {
    const { promotion } = await promotions.createPromotion(createRequest({ code: 'FIXED1' }));
    const updated = await promotions.updatePromotion({ id: promotion!.id, isActive: false });
    expect(updated.promotion!.discountValue).toBe(10);
  });

  it('delete then restore round-trips through NOT_FOUND in between', async () => {
    const { promotion } = await promotions.createPromotion(createRequest({ code: 'ROUNDTRIP' }));
    await promotions.deletePromotion({ id: promotion!.id }, caller);

    const deleted = await promotions.getPromotion({ id: promotion!.id });
    expect(deleted.promotion!.code).toBe('ROUNDTRIP'); // still fetchable by id, deletedAt is internal

    await expect(promotions.deletePromotion({ id: promotion!.id }, caller)).rejects.toSatisfy(
      (e: unknown) => errorCodeOf(e) === 'INVALID_STATE',
    );

    const restored = await promotions.restorePromotion({ id: promotion!.id });
    expect(restored.promotion!.code).toBe('ROUNDTRIP');
  });

  it('lists with a code prefix filter', async () => {
    await promotions.createPromotion(createRequest({ code: 'PREFIXA' }));
    await promotions.createPromotion(createRequest({ code: 'PREFIXB' }));
    await promotions.createPromotion(createRequest({ code: 'OTHER' }));

    const response = await promotions.listPromotions({
      page: { page: 1, pageSize: 20, sort: '-createdAt' },
      q: 'prefix',
    });
    expect(response.promotions.map((r) => r.code).sort(compareStrings)).toEqual([
      'PREFIXA',
      'PREFIXB',
    ]);
  });
});
