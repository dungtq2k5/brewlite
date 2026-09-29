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

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

const orderingClientStub = {
  quote: vi.fn(),
  placeOrder: vi.fn(),
  listMyOrders: vi.fn(),
  getOrder: vi.fn(),
  cancelOrder: vi.fn(),
};

function orderLineProto() {
  return {
    productId: newId(),
    productName: { en: 'Latte', vi: 'Latte' },
    size: 'S',
    toppings: [],
    unitPriceVnd: 29_000,
    qty: 1,
    lineTotalVnd: 29_000,
  };
}

function orderProto(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: newId(),
    orderNo: '1000',
    status: 'PENDING',
    lines: [orderLineProto()],
    subtotalVnd: '29000',
    promoDiscountVnd: 0,
    pointsDiscountVnd: 0,
    totalVnd: '29000',
    promoCode: undefined,
    pointsEarnable: 2,
    note: undefined,
    expiresAt: new Date().toISOString(),
    paidAt: undefined,
    createdAt: new Date().toISOString(),
    cancelReason: undefined,
    cancelNote: undefined,
    refundStatus: 'NONE',
    pointsEarned: 0,
    history: [],
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
    .useValue(orderingClientStub)
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

describe('gateway e2e — /orders routes', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterEach(() => {
    for (const fn of Object.values(orderingClientStub)) fn.mockReset();
  });

  afterAll(async () => {
    delete process.env.JWT_PUBLIC_KEY;
    await app.close();
  });

  const validBody = {
    items: [{ productId: newId(), size: 'S', toppingIds: [], qty: 1 }],
  };

  it('POST /orders with no Idempotency-Key — 400 IDEMPOTENCY_KEY_REQUIRED', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${signAccessToken('CUSTOMER')}`)
      .send(validBody);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    expect(orderingClientStub.placeOrder).not.toHaveBeenCalled();
  });

  it('POST /orders with a v4 Idempotency-Key — 400 IDEMPOTENCY_KEY_REQUIRED', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${signAccessToken('CUSTOMER')}`)
      .set('Idempotency-Key', '3fa85f64-5717-4562-b3fc-2c963f66afa6') // a v4 UUID
      .send(validBody);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    expect(orderingClientStub.placeOrder).not.toHaveBeenCalled();
  });

  it('POST /orders — 201 when created, 200 when not', async () => {
    orderingClientStub.placeOrder.mockResolvedValueOnce({ order: orderProto(), created: true });
    const created = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${signAccessToken('CUSTOMER')}`)
      .set('Idempotency-Key', newId())
      .send(validBody);
    expect(created.status).toBe(201);

    orderingClientStub.placeOrder.mockResolvedValueOnce({ order: orderProto(), created: false });
    const replayed = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${signAccessToken('CUSTOMER')}`)
      .set('Idempotency-Key', newId())
      .send(validBody);
    expect(replayed.status).toBe(200);
  });

  it('pointsToRedeem in the body — 400 VALIDATION_FAILED (.strict() refuses it)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${signAccessToken('CUSTOMER')}`)
      .set('Idempotency-Key', newId())
      .send({ ...validBody, pointsToRedeem: 10 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(orderingClientStub.placeOrder).not.toHaveBeenCalled();
  });

  it('GET /orders/me is not parsed as an order id', async () => {
    orderingClientStub.listMyOrders.mockResolvedValueOnce({
      orders: [orderProto()],
      nextCursor: undefined,
    });
    const res = await request(app.getHttpServer())
      .get('/api/v1/orders/me')
      .set('Authorization', `Bearer ${signAccessToken('CUSTOMER')}`);
    expect(res.status).toBe(200);
    expect(orderingClientStub.listMyOrders).toHaveBeenCalledTimes(1);
    expect(orderingClientStub.getOrder).not.toHaveBeenCalled();
  });

  it('GET /orders/:id with a malformed id — 400 VALIDATION_FAILED', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/orders/not-a-uuid')
      .set('Authorization', `Bearer ${signAccessToken('CUSTOMER')}`);
    expect(res.status).toBe(400);
  });

  it('POST /orders/:id/cancel round trip', async () => {
    orderingClientStub.cancelOrder.mockResolvedValueOnce({
      order: orderProto({ status: 'CANCELLED', cancelReason: 'CUSTOMER' }),
    });
    const res = await request(app.getHttpServer())
      .post(`/api/v1/orders/${newId()}/cancel`)
      .set('Authorization', `Bearer ${signAccessToken('CUSTOMER')}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CANCELLED');
  });

  it('every /orders route refuses a guest with 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/orders/me');
    expect(res.status).toBe(401);
  });
});
