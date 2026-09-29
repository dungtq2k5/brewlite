import { generateKeyPairSync } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { JWT_AUDIENCE, JWT_ISSUER, newId } from '@brewlite/contracts';
import { CatalogServiceGrpcClient } from '../../src/modules/catalog/catalog-service-grpc.client.js';
import { CatalogStockGrpcClient } from '../../src/modules/catalog/catalog-stock-grpc.client.js';
import { IdentityServiceGrpcClient } from '../../src/modules/auth/identity-service-grpc.client.js';

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

const stockClientStub = {
  listStaffProducts: vi.fn(),
  setProductAvailability: vi.fn(),
  setStockQty: vi.fn(),
  setToppingAvailability: vi.fn(),
};

function staffProductProto(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: newId(),
    categoryId: newId(),
    name: { en: 'Latte', vi: 'Latte' },
    isAvailable: true,
    stockQty: undefined,
    version: 0,
    ...overrides,
  };
}

async function buildApp() {
  process.env.JWT_PUBLIC_KEY = Buffer.from(publicKeyPem, 'utf8').toString('base64');
  const { AppModule } = await import('../../src/app.module.js');
  const { configureApp } = await import('../../src/configure-app.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CatalogServiceGrpcClient)
    .useValue({ listCategories: vi.fn(), listProducts: vi.fn(), getProduct: vi.fn() })
    .overrideProvider(CatalogStockGrpcClient)
    .useValue(stockClientStub)
    .overrideProvider(IdentityServiceGrpcClient)
    .useValue({})
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

describe('gateway e2e — /staff routes', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterEach(() => {
    stockClientStub.listStaffProducts.mockReset();
    stockClientStub.setProductAvailability.mockReset();
    stockClientStub.setStockQty.mockReset();
    stockClientStub.setToppingAvailability.mockReset();
  });

  afterAll(async () => {
    delete process.env.JWT_PUBLIC_KEY;
    await app.close();
  });

  it('perm:stock.update refuses a CUSTOMER with 403', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/staff/products')
      .set('Authorization', `Bearer ${signAccessToken('CUSTOMER')}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PERMISSION_DENIED');
  });

  it('GET /staff/products — 200 with the list', async () => {
    stockClientStub.listStaffProducts.mockResolvedValue({ products: [staffProductProto()] });
    const res = await request(app.getHttpServer())
      .get('/api/v1/staff/products')
      .set('Authorization', `Bearer ${signAccessToken('STAFF')}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('PATCH /staff/products/:id/availability — 200', async () => {
    stockClientStub.setProductAvailability.mockResolvedValue({
      product: staffProductProto({ isAvailable: false }),
    });
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/staff/products/${newId()}/availability`)
      .set('Authorization', `Bearer ${signAccessToken('STAFF')}`)
      .send({ isAvailable: false });
    expect(res.status).toBe(200);
    expect(res.body.data.isAvailable).toBe(false);
  });

  it('PATCH /staff/products/:id/stock — 409 STOCK_VERSION_CONFLICT', async () => {
    stockClientStub.setStockQty.mockRejectedValue(
      Object.assign(new Error('grpc failure'), {
        code: 9,
        metadata: {
          get: (key: string) => {
            if (key === 'bl-error-code') return ['STOCK_VERSION_CONFLICT'];
            if (key === 'bl-error-details-bin') {
              return [
                Buffer.from(JSON.stringify({ currentVersion: 2, currentStockQty: 3 }), 'utf8'),
              ];
            }
            return [];
          },
        },
      }),
    );
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/staff/products/${newId()}/stock`)
      .set('Authorization', `Bearer ${signAccessToken('STAFF')}`)
      .send({ stockQty: 1, expectedVersion: 0 });
    expect(res.status).toBe(409);
    expect(res.body.error.details).toEqual({ currentVersion: 2, currentStockQty: 3 });
  });

  it('PATCH /staff/toppings/:id/availability — 200', async () => {
    stockClientStub.setToppingAvailability.mockResolvedValue({
      topping: {
        id: newId(),
        name: { en: 'Pearls', vi: 'Trân châu' },
        priceVnd: 8000,
        isAvailable: false,
      },
    });
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/staff/toppings/${newId()}/availability`)
      .set('Authorization', `Bearer ${signAccessToken('STAFF')}`)
      .send({ isAvailable: false });
    expect(res.status).toBe(200);
    expect(res.body.data.isAvailable).toBe(false);
  });
});
