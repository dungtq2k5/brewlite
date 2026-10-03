import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createE2eApp, type E2eApp } from './support/e2e-app.js';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { newId, PRODUCT_IMAGE_MAX_BYTES } from '@brewlite/contracts';
import { CatalogAdminGrpcClient } from '../../src/modules/catalog/catalog-admin-grpc.client.js';
import { CatalogServiceGrpcClient } from '../../src/modules/catalog/catalog-service-grpc.client.js';

const adminClientStub = {
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  restoreCategory: vi.fn(),
  listProducts: vi.fn(),
  getProduct: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  replaceSizes: vi.fn(),
  replaceToppings: vi.fn(),
  deleteProduct: vi.fn(),
  restoreProduct: vi.fn(),
  listToppings: vi.fn(),
  createTopping: vi.fn(),
  updateTopping: vi.fn(),
  deleteTopping: vi.fn(),
  restoreTopping: vi.fn(),
  setImage: vi.fn(),
  clearImage: vi.fn(),
};

function adminCategoryProto(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: newId(),
    name: { en: 'Juice', vi: 'Nuoc ep' },
    sortOrder: 0,
    isActive: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function adminProductProto(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: newId(),
    categoryId: newId(),
    categoryNameEn: 'Juice',
    categoryNameVi: 'Nuoc ep',
    name: { en: 'Orange Juice', vi: 'Nuoc cam' },
    basePriceVnd: 20_000,
    isAvailable: true,
    version: 0,
    sortOrder: 0,
    sizes: [{ size: 'S', priceDeltaVnd: 0 }],
    toppingIds: [],
    createdAt: new Date().toISOString(),
    ...overrides,
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

describe('gateway e2e — /admin/categories, /admin/products, /admin/toppings routes', () => {
  let app: NestExpressApplication;
  let e2e: E2eApp;

  beforeAll(async () => {
    e2e = await createE2eApp([
      [
        CatalogServiceGrpcClient,
        { listCategories: vi.fn(), listProducts: vi.fn(), getProduct: vi.fn() },
      ],
      [CatalogAdminGrpcClient, adminClientStub],
    ]);
    app = e2e.app;
  });

  afterEach(() => {
    for (const fn of Object.values(adminClientStub)) fn.mockReset();
  });

  afterAll(async () => {
    await e2e.close();
  });

  it('perm:menu.manage refuses a STAFF with 403', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${e2e.tokenFor('STAFF')}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PERMISSION_DENIED');
  });

  it('POST /admin/categories — 201, then 409 CATEGORY_NAME_TAKEN', async () => {
    adminClientStub.createCategory.mockResolvedValueOnce({ category: adminCategoryProto() });
    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`)
      .send({ name: { en: 'Juice', vi: 'Nuoc ep' } });
    expect(created.status).toBe(201);

    adminClientStub.createCategory.mockRejectedValueOnce(
      serviceError(6, 'CATEGORY_NAME_TAKEN', { locale: 'en' }),
    );
    const clash = await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`)
      .send({ name: { en: 'Juice', vi: 'Khac' } });
    expect(clash.status).toBe(409);
    expect(clash.body.error.details).toEqual({ locale: 'en' });
  });

  it('DELETE /admin/categories/:id — 409 CATEGORY_IN_USE', async () => {
    adminClientStub.deleteCategory.mockRejectedValue(serviceError(9, 'CATEGORY_IN_USE'));
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/admin/categories/${newId()}`)
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CATEGORY_IN_USE');
  });

  it('POST /admin/products — 201, then 422 RESOURCE_REFERENCE_INVALID for an unknown category', async () => {
    adminClientStub.createProduct.mockResolvedValueOnce({ product: adminProductProto() });
    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`)
      .send({
        categoryId: newId(),
        name: { en: 'Orange Juice', vi: 'Nuoc cam' },
        basePriceVnd: 20_000,
        sizes: [{ size: 'S', priceDeltaVnd: 0 }],
        toppingIds: [],
      });
    expect(created.status).toBe(201);

    adminClientStub.createProduct.mockRejectedValueOnce(
      serviceError(21, 'RESOURCE_REFERENCE_INVALID', { field: 'categoryId' }),
    );
    const bad = await request(app.getHttpServer())
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`)
      .send({
        categoryId: newId(),
        name: { en: 'X', vi: 'X' },
        basePriceVnd: 1_000,
        sizes: [{ size: 'S', priceDeltaVnd: 0 }],
        toppingIds: [],
      });
    expect(bad.status).toBe(422);
    expect(bad.body.error.details).toEqual({ field: 'categoryId' });
  });

  it('PUT /admin/products/:id/sizes — 400 VALIDATION_FAILED for an empty array', async () => {
    const res = await request(app.getHttpServer())
      .put(`/api/v1/admin/products/${newId()}/sizes`)
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`)
      .send({ sizes: [] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(adminClientStub.replaceSizes).not.toHaveBeenCalled();
  });

  it('DELETE /admin/products/:id — 204 with no body', async () => {
    adminClientStub.deleteProduct.mockResolvedValue({ product: adminProductProto() });
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/admin/products/${newId()}`)
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`);
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it('GET /admin/products — 200 with the paged meta', async () => {
    adminClientStub.listProducts.mockResolvedValue({
      products: [adminProductProto()],
      meta: { page: 1, pageSize: 20, total: 1 },
    });
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/products')
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`);
    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 1 });
  });

  it('?sort=password is refused with 400 VALIDATION_FAILED', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/products?sort=password')
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('POST /admin/toppings — 201, then 409 TOPPING_NAME_TAKEN', async () => {
    adminClientStub.createTopping.mockResolvedValueOnce({
      topping: {
        id: newId(),
        name: { en: 'Boba', vi: 'Tran chau' },
        priceVnd: 8_000,
        isAvailable: true,
        createdAt: new Date().toISOString(),
      },
    });
    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/toppings')
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`)
      .send({ name: { en: 'Boba', vi: 'Tran chau' }, priceVnd: 8_000 });
    expect(created.status).toBe(201);

    adminClientStub.createTopping.mockRejectedValueOnce(
      serviceError(6, 'TOPPING_NAME_TAKEN', { locale: 'en' }),
    );
    const clash = await request(app.getHttpServer())
      .post('/api/v1/admin/toppings')
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`)
      .send({ name: { en: 'Boba', vi: 'X' }, priceVnd: 1_000 });
    expect(clash.status).toBe(409);
  });

  it('PUT /admin/products/:id/image — 200 with imageUrl', async () => {
    adminClientStub.setImage.mockResolvedValueOnce({
      product: {
        ...adminProductProto(),
        imageUrl: 'http://localhost:29199/v0/b/x/o/products%2Fa?alt=media',
      },
    });
    const res = await request(app.getHttpServer())
      .put(`/api/v1/admin/products/${newId()}/image`)
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`)
      .attach('file', Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'latte.jpg');
    expect(res.status).toBe(200);
    expect(res.body.data.imageUrl).toBe('http://localhost:29199/v0/b/x/o/products%2Fa?alt=media');
  });

  it('PUT /admin/products/:id/image with no file part — 400 VALIDATION_FAILED', async () => {
    const res = await request(app.getHttpServer())
      .put(`/api/v1/admin/products/${newId()}/image`)
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(adminClientStub.setImage).not.toHaveBeenCalled();
  });

  it('PUT /admin/products/:id/image over the size limit — 422 IMAGE_INVALID SIZE, without reaching the stub', async () => {
    const tooBig = Buffer.alloc(PRODUCT_IMAGE_MAX_BYTES + 1, 0xff);
    const res = await request(app.getHttpServer())
      .put(`/api/v1/admin/products/${newId()}/image`)
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`)
      .attach('file', tooBig, 'big.jpg');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('IMAGE_INVALID');
    expect(res.body.error.details).toEqual({ reason: 'SIZE' });
    expect(adminClientStub.setImage).not.toHaveBeenCalled();
  });

  it('DELETE /admin/products/:id/image — 204 with no body', async () => {
    adminClientStub.clearImage.mockResolvedValueOnce({ product: adminProductProto() });
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/admin/products/${newId()}/image`)
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`);
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });
});
