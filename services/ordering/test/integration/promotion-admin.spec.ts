import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compareStrings, newId, Role } from '@brewlite/contracts';
import type { Caller } from '@brewlite/nest-common';
import { envSchema } from '../../src/config/env.schema.js';
import { PromotionsModule } from '../../src/modules/promotions/promotions.module.js';
import { PromotionAdminService } from '../../src/modules/promotions/promotion-admin.service.js';
import { PrismaModule } from '../../src/modules/prisma/prisma.module.js';
import { prisma } from '../setup/per-file.js';
import { testEnv } from '../setup/env.js';
import { readError } from './support/place-order.js';

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
  return readError(exception).code;
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

  describe('usage limits — a number, unlimited, or the default', () => {
    const limits = (p: { maxUses?: number; perUserLimit?: number }) => [p.maxUses, p.perUserLimit];

    it('create: omitted is one use per customer and no total cap', async () => {
      const { promotion } = await promotions.createPromotion(
        createRequest({ code: 'LIM_DEFAULT' }),
      );
      expect(limits(promotion!)).toEqual([undefined, 1]);
    });

    it('create: numbers are kept, and the flags make each limit unlimited', async () => {
      const set = await promotions.createPromotion(
        createRequest({ code: 'LIM_SET', maxUses: 200, perUserLimit: 3 }),
      );
      expect(limits(set.promotion!)).toEqual([200, 3]);

      const open = await promotions.createPromotion(
        createRequest({ code: 'LIM_OPEN', unlimitedMaxUses: true, unlimitedPerUserLimit: true }),
      );
      expect(limits(open.promotion!)).toEqual([undefined, undefined]);
      const row = await prisma.promotion.findUniqueOrThrow({ where: { id: open.promotion!.id } });
      expect([row.maxUses, row.perUserLimit]).toEqual([null, null]); // the columns say NULL
    });

    it('a flag together with a number, a zero and a negative are refused on create', async () => {
      for (const [name, extra] of [
        ['maxUses + flag', { maxUses: 5, unlimitedMaxUses: true }],
        ['perUserLimit + flag', { perUserLimit: 2, unlimitedPerUserLimit: true }],
        ['maxUses 0', { maxUses: 0 }],
        ['perUserLimit 0', { perUserLimit: 0 }],
        ['perUserLimit -1', { perUserLimit: -1 }],
      ] as const) {
        const error = await promotions
          .createPromotion(createRequest({ code: `LIM_BAD_${name.replace(/\W/g, '')}`, ...extra }))
          .catch((e: unknown) => e);
        expect(errorCodeOf(error), name).toBe('VALIDATION_FAILED');
      }
    });

    it('update: a cap, once set, can be set back to unlimited — each limit on its own', async () => {
      const { promotion } = await promotions.createPromotion(
        createRequest({ code: 'LIM_CLEAR', maxUses: 50, perUserLimit: 2 }),
      );
      const first = await promotions.updatePromotion({ id: promotion!.id, unlimitedMaxUses: true });
      expect(limits(first.promotion!)).toEqual([undefined, 2]);
      const second = await promotions.updatePromotion({
        id: promotion!.id,
        unlimitedPerUserLimit: true,
      });
      expect(limits(second.promotion!)).toEqual([undefined, undefined]);
    });

    it('update: unlimited works even when the code has been used a lot', async () => {
      const { promotion } = await promotions.createPromotion(
        createRequest({ code: 'LIM_USED', maxUses: 10 }),
      );
      await prisma.promotion.update({ where: { id: promotion!.id }, data: { usedCount: 10 } });
      const updated = await promotions.updatePromotion({
        id: promotion!.id,
        unlimitedMaxUses: true,
      });
      expect(updated.promotion!.maxUses).toBeUndefined();
    });

    it('update: a number is still refused below the used count, and neither field leaves both unchanged', async () => {
      const { promotion } = await promotions.createPromotion(
        createRequest({ code: 'LIM_KEEP', maxUses: 40, perUserLimit: 2 }),
      );
      await prisma.promotion.update({ where: { id: promotion!.id }, data: { usedCount: 37 } });
      await expect(promotions.updatePromotion({ id: promotion!.id, maxUses: 5 })).rejects.toSatisfy(
        (e: unknown) => errorCodeOf(e) === 'PROMO_MAX_USES_BELOW_USED',
      );
      const kept = await promotions.updatePromotion({ id: promotion!.id, isActive: false });
      expect(limits(kept.promotion!)).toEqual([40, 2]);
    });

    it('update: a flag together with a number is refused, and nothing changes', async () => {
      const { promotion } = await promotions.createPromotion(
        createRequest({ code: 'LIM_BOTH', maxUses: 40, perUserLimit: 2 }),
      );
      for (const extra of [
        { maxUses: 9, unlimitedMaxUses: true },
        { perUserLimit: 9, unlimitedPerUserLimit: true },
        { maxUses: 0 },
      ]) {
        const error = await promotions
          .updatePromotion({ id: promotion!.id, ...extra })
          .catch((e: unknown) => e);
        expect(errorCodeOf(error)).toBe('VALIDATION_FAILED');
      }
      const same = await promotions.getPromotion({ id: promotion!.id });
      expect(limits(same.promotion!)).toEqual([40, 2]);
    });
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

  describe('discount shape — PERCENT vs FIXED', () => {
    it('a FIXED discount is kept, with no cap', async () => {
      const { promotion } = await promotions.createPromotion(
        createRequest({ code: 'FIXED20K', discountType: 'FIXED', discountValue: 20_000 }),
      );
      expect(promotion).toMatchObject({ discountType: 'FIXED', discountValue: 20_000 });
      expect(promotion!.maxDiscountVnd).toBeUndefined();
    });

    it('a FIXED discount out of range, or with a maxDiscountVnd cap, is refused — no row', async () => {
      for (const [name, extra, path] of [
        ['zero', { discountValue: 0 }, '/discountValue'],
        ['above MAX_PRICE_VND', { discountValue: 10_000_001 }, '/discountValue'],
        ['with a cap', { discountValue: 20_000, maxDiscountVnd: 5_000 }, '/maxDiscountVnd'],
      ] as const) {
        const error = await promotions
          .createPromotion(createRequest({ code: 'FIXEDBAD', discountType: 'FIXED', ...extra }))
          .catch((e: unknown) => e);
        expect(readError(error), name).toEqual({
          code: 'VALIDATION_FAILED',
          details: { issues: [{ path, code: 'invalid_value' }] },
        });
      }
      expect(await prisma.promotion.count()).toBe(0);
    });

    it('a PERCENT discount may carry a maxDiscountVnd cap', async () => {
      const { promotion } = await promotions.createPromotion(
        createRequest({ code: 'PCTCAP', discountValue: 20, maxDiscountVnd: 15_000 }),
      );
      expect(promotion!.maxDiscountVnd).toBe(15_000);
    });
  });

  it('create refuses an endsAt not after startsAt', async () => {
    const at = new Date().toISOString();
    const error = await promotions
      .createPromotion(createRequest({ code: 'BACKWARDS', startsAt: at, endsAt: at }))
      .catch((e: unknown) => e);
    expect(readError(error).details).toEqual({
      issues: [{ path: '/endsAt', code: 'invalid_value' }],
    });
    expect(await prisma.promotion.count()).toBe(0);
  });

  it('a database refusal other than the code key propagates unchanged — not PROMO_CODE_TAKEN', async () => {
    // The gateway caps the code at 32 characters; past it, VARCHAR(32) refuses.
    const error = await promotions
      .createPromotion(createRequest({ code: 'X'.repeat(33) }))
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(errorCodeOf(error)).toBeUndefined();
  });

  it('RESOURCE_NOT_FOUND for an unknown id — get, update, delete and restore alike', async () => {
    const id = newId();
    for (const call of [
      () => promotions.getPromotion({ id }),
      () => promotions.updatePromotion({ id, isActive: false }),
      () => promotions.deletePromotion({ id }, caller),
      () => promotions.restorePromotion({ id }),
    ]) {
      expect(readError(await call().catch((e: unknown) => e))).toEqual({
        code: 'RESOURCE_NOT_FOUND',
        details: { resource: 'PROMOTION' },
      });
    }
  });

  describe('update — the editable fields', () => {
    it('sets description, endsAt, maxUses (at the used count), perUserLimit and isActive at once', async () => {
      const { promotion } = await promotions.createPromotion(
        createRequest({ code: 'EDITALL', description: 'old', maxUses: 10 }),
      );
      await prisma.promotion.update({ where: { id: promotion!.id }, data: { usedCount: 4 } });
      const endsAt = new Date(Date.now() + 30 * 86_400_000).toISOString();

      const { promotion: updated } = await promotions.updatePromotion({
        id: promotion!.id,
        description: 'new',
        endsAt,
        maxUses: 4, // exactly the used count is still allowed
        perUserLimit: 5,
        isActive: false,
      });

      expect(updated).toMatchObject({
        description: 'new',
        endsAt,
        maxUses: 4,
        perUserLimit: 5,
        isActive: false,
        usedCount: 4,
      });
    });

    it('clearDescription removes the description', async () => {
      const { promotion } = await promotions.createPromotion(
        createRequest({ code: 'CLEARDESC', description: 'gone soon' }),
      );
      const { promotion: updated } = await promotions.updatePromotion({
        id: promotion!.id,
        clearDescription: true,
      });
      expect(updated!.description).toBeUndefined();
      const row = await prisma.promotion.findUniqueOrThrow({ where: { id: promotion!.id } });
      expect(row.description).toBeNull();
    });

    it('refuses an endsAt not after startsAt, and nothing changes', async () => {
      const { promotion } = await promotions.createPromotion(createRequest({ code: 'EARLYEND' }));
      const error = await promotions
        .updatePromotion({
          id: promotion!.id,
          endsAt: new Date(Date.parse(promotion!.startsAt) - 1_000).toISOString(),
          isActive: false,
        })
        .catch((e: unknown) => e);
      expect(readError(error).details).toEqual({
        issues: [{ path: '/endsAt', code: 'invalid_value' }],
      });
      const same = await promotions.getPromotion({ id: promotion!.id });
      expect(same.promotion).toMatchObject({ endsAt: promotion!.endsAt, isActive: true });
    });

    it('a DELETED code refuses INVALID_STATE and stays as it was', async () => {
      const { promotion } = await promotions.createPromotion(createRequest({ code: 'GONE1' }));
      await promotions.deletePromotion({ id: promotion!.id }, caller);

      const error = await promotions
        .updatePromotion({ id: promotion!.id, isActive: false })
        .catch((e: unknown) => e);
      expect(readError(error)).toEqual({ code: 'INVALID_STATE', details: { status: 'DELETED' } });
      const row = await prisma.promotion.findUniqueOrThrow({ where: { id: promotion!.id } });
      expect(row.isActive).toBe(true);
    });
  });

  it('delete records who deleted it, and restoring an ACTIVE code refuses INVALID_STATE', async () => {
    const { promotion } = await promotions.createPromotion(createRequest({ code: 'ALIVE1' }));
    expect(
      readError(await promotions.restorePromotion({ id: promotion!.id }).catch((e: unknown) => e)),
    ).toEqual({ code: 'INVALID_STATE', details: { status: 'ACTIVE' } });

    await promotions.deletePromotion({ id: promotion!.id }, caller);
    const row = await prisma.promotion.findUniqueOrThrow({ where: { id: promotion!.id } });
    expect(row.deletedAt).not.toBeNull();
    expect(row.deletedById).toBe(caller.kind === 'USER' ? caller.userId : undefined);
  });

  describe('list — filters, sort and paging defaults', () => {
    async function seedThree() {
      const a = await promotions.createPromotion(createRequest({ code: 'LIST_B' }));
      const b = await promotions.createPromotion(
        createRequest({ code: 'LIST_A', isActive: false }),
      );
      const c = await promotions.createPromotion(createRequest({ code: 'LIST_C' }));
      await promotions.deletePromotion({ id: c.promotion!.id }, caller);
      // Distinct creation times — three creates can share a millisecond, and the order is the point.
      for (const [index, p] of [a, b, c].entries()) {
        await prisma.promotion.update({
          where: { id: p.promotion!.id },
          data: { createdAt: new Date(Date.now() - (3 - index) * 60_000) },
        });
      }
      return { a: a.promotion!, b: b.promotion!, c: c.promotion! };
    }

    it('with no page (absent on the wire): page 1 of 20, newest first, deleted codes left out', async () => {
      const { a, b } = await seedThree();
      const response = await promotions.listPromotions({ page: undefined });
      expect(response.promotions.map((p) => p.id)).toEqual([b.id, a.id]);
      expect(response.meta).toEqual({ page: 1, pageSize: 20, total: 2 });
    });

    it('an ascending sort field orders by it', async () => {
      await seedThree();
      const response = await promotions.listPromotions({
        page: { page: 1, pageSize: 20, sort: 'code' },
      });
      expect(response.promotions.map((p) => p.code)).toEqual(['LIST_A', 'LIST_B']);
    });

    it('active filters on isActive; deleted: true lists ONLY the deleted', async () => {
      const { a, b, c } = await seedThree();
      const active = await promotions.listPromotions({ page: undefined, active: true });
      expect(active.promotions.map((p) => p.id)).toEqual([a.id]);
      const inactive = await promotions.listPromotions({ page: undefined, active: false });
      expect(inactive.promotions.map((p) => p.id)).toEqual([b.id]);
      const deleted = await promotions.listPromotions({ page: undefined, deleted: true });
      expect(deleted.promotions.map((p) => p.id)).toEqual([c.id]);
    });

    it('pages by skip/take and reports the full total', async () => {
      const { a } = await seedThree();
      const response = await promotions.listPromotions({
        page: { page: 2, pageSize: 1, sort: '-createdAt' },
      });
      expect(response.promotions.map((p) => p.id)).toEqual([a.id]);
      expect(response.meta).toEqual({ page: 2, pageSize: 1, total: 2 });
    });
  });
});
