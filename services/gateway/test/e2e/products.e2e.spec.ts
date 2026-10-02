import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/configure-app.js';
import { CatalogServiceGrpcClient } from '../../src/modules/catalog/catalog-service-grpc.client.js';

const PRODUCT_ID = '01a0d799-fda1-7c3e-8da5-3b5de192d879';
const CATEGORY_ID = '01a0d799-fda1-7c3e-8da5-3b5de192d880';
const V4_ID = '11a0d799-fda1-4c3e-8da5-3b5de192d879';

const grpcClientStub = {
  listCategories: vi.fn(),
  listProducts: vi.fn(),
  getProduct: vi.fn(),
};

function summaryProto() {
  return {
    id: PRODUCT_ID,
    categoryId: CATEGORY_ID,
    name: { en: 'Iced milk coffee', vi: 'Cà phê sữa đá' },
    imageUrl: undefined,
    fromPriceVnd: 29_000,
    isSoldOut: false,
  };
}

function serviceError(code: number, blCode?: string, details?: unknown) {
  return Object.assign(new Error('grpc failure'), {
    code,
    metadata: {
      get: (key: string) => {
        if (key === 'bl-error-code') return blCode ? [blCode] : [];
        if (key === 'bl-error-details-bin' && details !== undefined) {
          return [Buffer.from(JSON.stringify(details), 'utf8')];
        }
        return [];
      },
    },
  });
}

async function buildApp() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CatalogServiceGrpcClient)
    .useValue(grpcClientStub)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true });
  configureApp(app);
  await app.init();
  return app;
}

describe('gateway e2e — GET /products, GET /products/:id', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterEach(() => {
    grpcClientStub.listProducts.mockReset();
    grpcClientStub.getProduct.mockReset();
  });

  afterAll(async () => {
    await app.close();
  });

  it('envelopes the product list as { data }', async () => {
    grpcClientStub.listProducts.mockResolvedValue({ products: [summaryProto()] });
    const res = await request(app.getHttpServer()).get('/api/v1/products');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: [
        {
          id: PRODUCT_ID,
          categoryId: CATEGORY_ID,
          name: { en: 'Iced milk coffee', vi: 'Cà phê sữa đá' },
          imageUrl: null,
          fromPriceVnd: 29_000,
          isSoldOut: false,
        },
      ],
    });
  });

  it('forwards a valid ?categoryId to the client', async () => {
    grpcClientStub.listProducts.mockResolvedValue({ products: [] });
    await request(app.getHttpServer()).get(`/api/v1/products?categoryId=${CATEGORY_ID}`);
    expect(grpcClientStub.listProducts).toHaveBeenCalledWith(
      { categoryId: CATEGORY_ID },
      expect.anything(),
    );
  });

  it('refuses an invalid ?categoryId with 400 VALIDATION_FAILED', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/products?categoryId=not-a-uuid');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('refuses a v4 id in ?categoryId with 400', async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/products?categoryId=${V4_ID}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('envelopes a product detail, flattening summary into the top level', async () => {
    grpcClientStub.getProduct.mockResolvedValue({
      product: {
        summary: summaryProto(),
        description: { en: 'Sweet and cold', vi: 'Ngọt và lạnh' },
        basePriceVnd: 29_000,
        sizes: [{ size: 'S', priceDeltaVnd: 0 }],
        toppings: [],
        maxToppings: 3,
      },
    });
    const res = await request(app.getHttpServer()).get(`/api/v1/products/${PRODUCT_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      id: PRODUCT_ID,
      categoryId: CATEGORY_ID,
      name: { en: 'Iced milk coffee', vi: 'Cà phê sữa đá' },
      imageUrl: null,
      fromPriceVnd: 29_000,
      isSoldOut: false,
      description: { en: 'Sweet and cold', vi: 'Ngọt và lạnh' },
      basePriceVnd: 29_000,
      sizes: [{ size: 'S', priceDeltaVnd: 0 }],
      toppings: [],
      maxToppings: 3,
    });
  });

  it('refuses a v4 id in :id with 400', async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/products/${V4_ID}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('maps a stubbed RESOURCE_NOT_FOUND to 404 with its details', async () => {
    grpcClientStub.getProduct.mockRejectedValue(
      serviceError(5, 'RESOURCE_NOT_FOUND', { resource: 'PRODUCT' }),
    );
    const res = await request(app.getHttpServer()).get(`/api/v1/products/${PRODUCT_ID}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    expect(res.body.error.details).toEqual({ resource: 'PRODUCT' });
  });
});
