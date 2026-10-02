import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createE2eApp, type E2eApp } from './support/e2e-app.js';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { newId } from '@brewlite/contracts';
import { CatalogServiceGrpcClient } from '../../src/modules/catalog/catalog-service-grpc.client.js';
import { CatalogStockGrpcClient } from '../../src/modules/catalog/catalog-stock-grpc.client.js';

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

describe('gateway e2e — /staff routes', () => {
  let app: NestExpressApplication;
  let e2e: E2eApp;

  beforeAll(async () => {
    e2e = await createE2eApp([
      [
        CatalogServiceGrpcClient,
        { listCategories: vi.fn(), listProducts: vi.fn(), getProduct: vi.fn() },
      ],
      [CatalogStockGrpcClient, stockClientStub],
    ]);
    app = e2e.app;
  });

  afterEach(() => {
    stockClientStub.listStaffProducts.mockReset();
    stockClientStub.setProductAvailability.mockReset();
    stockClientStub.setStockQty.mockReset();
    stockClientStub.setToppingAvailability.mockReset();
  });

  afterAll(async () => {
    await e2e.close();
  });

  it('perm:stock.update refuses a CUSTOMER with 403', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/staff/products')
      .set('Authorization', `Bearer ${e2e.tokenFor('CUSTOMER')}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PERMISSION_DENIED');
  });

  it('GET /staff/products — 200 with the list', async () => {
    stockClientStub.listStaffProducts.mockResolvedValue({ products: [staffProductProto()] });
    const res = await request(app.getHttpServer())
      .get('/api/v1/staff/products')
      .set('Authorization', `Bearer ${e2e.tokenFor('STAFF')}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('PATCH /staff/products/:id/availability — 200', async () => {
    stockClientStub.setProductAvailability.mockResolvedValue({
      product: staffProductProto({ isAvailable: false }),
    });
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/staff/products/${newId()}/availability`)
      .set('Authorization', `Bearer ${e2e.tokenFor('STAFF')}`)
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
      .set('Authorization', `Bearer ${e2e.tokenFor('STAFF')}`)
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
      .set('Authorization', `Bearer ${e2e.tokenFor('STAFF')}`)
      .send({ isAvailable: false });
    expect(res.status).toBe(200);
    expect(res.body.data.isAvailable).toBe(false);
  });
});
