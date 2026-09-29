import { generateKeyPairSync } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { JWT_AUDIENCE, JWT_ISSUER, newId } from '@brewlite/contracts';
import { CatalogServiceGrpcClient } from '../../src/modules/catalog/catalog-service-grpc.client.js';
import { CatalogStockGrpcClient } from '../../src/modules/catalog/catalog-stock-grpc.client.js';
import { CatalogAdminGrpcClient } from '../../src/modules/catalog/catalog-admin-grpc.client.js';
import { OrderingServiceGrpcClient } from '../../src/modules/orders/ordering-service-grpc.client.js';
import { IdentityServiceGrpcClient } from '../../src/modules/auth/identity-service-grpc.client.js';
import { PromotionAdminGrpcClient } from '../../src/modules/promotions/promotion-admin-grpc.client.js';
import { LoyaltyGrpcClient } from '../../src/modules/loyalty/loyalty-grpc.client.js';

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

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

async function buildApp() {
  process.env.JWT_PUBLIC_KEY = Buffer.from(publicKeyPem, 'utf8').toString('base64');
  const { AppModule } = await import('../../src/app.module.js');
  const { configureApp } = await import('../../src/configure-app.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CatalogServiceGrpcClient)
    .useValue({})
    .overrideProvider(CatalogStockGrpcClient)
    .useValue({})
    .overrideProvider(CatalogAdminGrpcClient)
    .useValue({})
    .overrideProvider(IdentityServiceGrpcClient)
    .useValue({})
    .overrideProvider(OrderingServiceGrpcClient)
    .useValue({})
    .overrideProvider(PromotionAdminGrpcClient)
    .useValue(promotionAdminStub)
    .overrideProvider(LoyaltyGrpcClient)
    .useValue(loyaltyStub)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true });
  configureApp(app);
  await app.init();
  return app;
}

function signAccessToken(role: string) {
  const jwt = new JwtService();
  return jwt.sign(
    { sub: newId(), role, sid: newId() },
    {
      algorithm: 'ES256',
      privateKey: privateKeyPem,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      expiresIn: 900,
    },
  );
}

describe('gateway e2e — /admin/promotions and /loyalty routes', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterEach(() => {
    for (const fn of Object.values(promotionAdminStub)) fn.mockReset();
    loyaltyStub.getMyLoyalty.mockReset();
  });

  afterAll(async () => {
    delete process.env.JWT_PUBLIC_KEY;
    await app.close();
  });

  it('GET /admin/promotions refused to STAFF — 403', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/promotions')
      .set('Authorization', `Bearer ${signAccessToken('STAFF')}`);
    expect(res.status).toBe(403);
    expect(promotionAdminStub.listPromotions).not.toHaveBeenCalled();
  });

  it('POST /admin/promotions as ADMIN creates a code — 201', async () => {
    promotionAdminStub.createPromotion.mockResolvedValueOnce({ promotion: promotionProto() });
    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/promotions')
      .set('Authorization', `Bearer ${signAccessToken('ADMIN')}`)
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
      .set('Authorization', `Bearer ${signAccessToken('ADMIN')}`)
      .send({ discountValue: 50 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(promotionAdminStub.updatePromotion).not.toHaveBeenCalled();
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
      .set('Authorization', `Bearer ${signAccessToken('CUSTOMER')}`);
    expect(res.status).toBe(200);
    expect(res.body.data.balance).toBe(5);
  });
});
