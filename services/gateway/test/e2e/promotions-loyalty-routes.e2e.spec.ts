import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createE2eApp, type E2eApp } from './support/e2e-app.js';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { newId } from '@brewlite/contracts';
import { PromotionAdminGrpcClient } from '../../src/modules/promotions/promotion-admin-grpc.client.js';
import { LoyaltyGrpcClient } from '../../src/modules/loyalty/loyalty-grpc.client.js';

const promotionAdminStub = {
  listPromotions: vi.fn(),
  createPromotion: vi.fn(),
  getPromotion: vi.fn(),
  updatePromotion: vi.fn(),
  deletePromotion: vi.fn(),
  restorePromotion: vi.fn(),
};

const loyaltyStub = { getMyLoyalty: vi.fn() };

function promotionProto(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: newId(),
    code: 'WELCOME10',
    description: undefined,
    discountType: 'PERCENT',
    discountValue: 10,
    maxDiscountVnd: undefined,
    minSubtotalVnd: 0,
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 86_400_000).toISOString(),
    maxUses: undefined,
    usedCount: 0,
    perUserLimit: 1,
    isActive: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('gateway e2e — /admin/promotions and /loyalty routes', () => {
  let app: NestExpressApplication;
  let e2e: E2eApp;

  beforeAll(async () => {
    e2e = await createE2eApp([
      [PromotionAdminGrpcClient, promotionAdminStub],
      [LoyaltyGrpcClient, loyaltyStub],
    ]);
    app = e2e.app;
  });

  afterEach(() => {
    for (const fn of Object.values(promotionAdminStub)) fn.mockReset();
    loyaltyStub.getMyLoyalty.mockReset();
  });

  afterAll(async () => {
    await e2e.close();
  });

  it('GET /admin/promotions refused to STAFF — 403', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/promotions')
      .set('Authorization', `Bearer ${e2e.tokenFor('STAFF')}`);
    expect(res.status).toBe(403);
    expect(promotionAdminStub.listPromotions).not.toHaveBeenCalled();
  });

  it('POST /admin/promotions as ADMIN creates a code — 201', async () => {
    promotionAdminStub.createPromotion.mockResolvedValueOnce({ promotion: promotionProto() });
    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/promotions')
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`)
      .send({
        code: 'welcome10',
        discountType: 'PERCENT',
        discountValue: 10,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 86_400_000).toISOString(),
      });
    expect(res.status).toBe(201);
    expect(promotionAdminStub.createPromotion).toHaveBeenCalledOnce();
  });

  it('PATCH /admin/promotions/:id with discountValue — 400 VALIDATION_FAILED (.strict() refuses it)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/promotions/${newId()}`)
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`)
      .send({ discountValue: 50 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(promotionAdminStub.updatePromotion).not.toHaveBeenCalled();
  });

  describe('usage limits: a number, null (unlimited) or omitted', () => {
    const admin = () => ({ Authorization: `Bearer ${e2e.tokenFor('ADMIN')}` });
    const base = {
      code: 'SUMMER15',
      discountType: 'PERCENT',
      discountValue: 15,
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 86_400_000).toISOString(),
    };
    const create = (extra: Record<string, unknown>) =>
      request(app.getHttpServer())
        .post('/api/v1/admin/promotions')
        .set(admin())
        .send({ ...base, ...extra });
    const patch = (extra: Record<string, unknown>) =>
      request(app.getHttpServer())
        .patch(`/api/v1/admin/promotions/${newId()}`)
        .set(admin())
        .send(extra);
    const sent = (stub: 'createPromotion' | 'updatePromotion') =>
      promotionAdminStub[stub].mock.calls[0]![0] as Record<string, unknown>;

    it('create: a number goes through, null becomes the unlimited flag, omitted sends neither', async () => {
      promotionAdminStub.createPromotion.mockResolvedValue({ promotion: promotionProto() });

      expect((await create({ maxUses: 200, perUserLimit: 3 })).status).toBe(201);
      expect(sent('createPromotion')).toMatchObject({ maxUses: 200, perUserLimit: 3 });
      expect(sent('createPromotion')).not.toHaveProperty('unlimitedMaxUses');

      promotionAdminStub.createPromotion.mockClear();
      expect((await create({ maxUses: null, perUserLimit: null })).status).toBe(201);
      expect(sent('createPromotion')).toMatchObject({
        unlimitedMaxUses: true,
        unlimitedPerUserLimit: true,
      });
      expect(sent('createPromotion')).not.toHaveProperty('maxUses');
      expect(sent('createPromotion')).not.toHaveProperty('perUserLimit');

      promotionAdminStub.createPromotion.mockClear();
      expect((await create({})).status).toBe(201);
      for (const key of ['maxUses', 'perUserLimit', 'unlimitedMaxUses', 'unlimitedPerUserLimit']) {
        expect(sent('createPromotion')).not.toHaveProperty(key);
      }
    });

    it('update: null sets the flag for that limit alone; a number and omitted behave as before', async () => {
      promotionAdminStub.updatePromotion.mockResolvedValue({ promotion: promotionProto() });

      expect((await patch({ maxUses: null })).status).toBe(200);
      expect(sent('updatePromotion')).toMatchObject({ unlimitedMaxUses: true });
      expect(sent('updatePromotion')).not.toHaveProperty('unlimitedPerUserLimit');

      promotionAdminStub.updatePromotion.mockClear();
      expect((await patch({ perUserLimit: null, maxUses: 5 })).status).toBe(200);
      expect(sent('updatePromotion')).toMatchObject({ unlimitedPerUserLimit: true, maxUses: 5 });

      promotionAdminStub.updatePromotion.mockClear();
      expect((await patch({ isActive: false })).status).toBe(200);
      for (const key of ['maxUses', 'perUserLimit', 'unlimitedMaxUses', 'unlimitedPerUserLimit']) {
        expect(sent('updatePromotion')).not.toHaveProperty(key);
      }
    });

    it.each([
      ['create maxUses 0', () => create({ maxUses: 0 })],
      ['create perUserLimit 0', () => create({ perUserLimit: 0 })],
      ['create perUserLimit -1', () => create({ perUserLimit: -1 })],
      ['update maxUses 0', () => patch({ maxUses: 0 })],
      ['update perUserLimit 0', () => patch({ perUserLimit: 0 })],
      ['update a fraction', () => patch({ perUserLimit: 1.5 })],
    ])('%s is refused with 400 VALIDATION_FAILED and never reaches ordering', async (_n, call) => {
      const res = await call();
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(promotionAdminStub.createPromotion).not.toHaveBeenCalled();
      expect(promotionAdminStub.updatePromotion).not.toHaveBeenCalled();
    });
  });

  it('GET /loyalty/me for a guest — 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/loyalty/me');
    expect(res.status).toBe(401);
    expect(loyaltyStub.getMyLoyalty).not.toHaveBeenCalled();
  });

  it('GET /loyalty/me for a signed-in customer — 200', async () => {
    loyaltyStub.getMyLoyalty.mockResolvedValueOnce({ balance: 5, lifetimeEarned: 5, recent: [] });
    const res = await request(app.getHttpServer())
      .get('/api/v1/loyalty/me')
      .set('Authorization', `Bearer ${e2e.tokenFor('CUSTOMER')}`);
    expect(res.status).toBe(200);
    expect(res.body.data.balance).toBe(5);
  });
});
