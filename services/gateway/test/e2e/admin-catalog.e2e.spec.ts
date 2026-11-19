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
  it('GET /admin/products/:id — 200 maps the description, nulls what the proto omits', async () => {
    const product = adminProductProto({ description: { en: 'Fresh', vi: 'Tuoi' } });
    adminClientStub.getProduct.mockResolvedValueOnce({ product });
    const res = await request(app.getHttpServer())
      .get(`/api/v1/admin/products/${product.id}`)
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: product.id,
      categoryName: { en: 'Juice', vi: 'Nuoc ep' },
      description: { en: 'Fresh', vi: 'Tuoi' },
      imageUrl: null,
      stockQty: null,
      deletedAt: null,
      deletedById: null,
    });
    expect(adminClientStub.getProduct).toHaveBeenCalledWith({ id: product.id }, expect.any(String));
  });

  it('GET /admin/products/:id — 404 RESOURCE_NOT_FOUND from the peer', async () => {
    adminClientStub.getProduct.mockRejectedValueOnce(
      serviceError(5, 'RESOURCE_NOT_FOUND', { resource: 'PRODUCT' }),
    );
    const res = await request(app.getHttpServer())
      .get(`/api/v1/admin/products/${newId()}`)
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
      details: { resource: 'PRODUCT' },
    });
  });

  it('PATCH /admin/products/:id with description NULL clears it; a value replaces it', async () => {
    const id = newId();
    adminClientStub.updateProduct.mockResolvedValue({ product: adminProductProto({ id }) });

    const cleared = await request(app.getHttpServer())
      .patch(`/api/v1/admin/products/${id}`)
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`)
      .send({ description: null, basePriceVnd: 25_000 });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.description).toBeNull();
    expect(adminClientStub.updateProduct).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id,
        description: undefined,
        clearDescription: true,
        basePriceVnd: 25_000,
      }),
      expect.any(String),
    );

    const replaced = await request(app.getHttpServer())
      .patch(`/api/v1/admin/products/${id}`)
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`)
      .send({ description: { en: 'New', vi: 'Moi' } });
    expect(replaced.status).toBe(200);
    expect(adminClientStub.updateProduct).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id,
        description: { en: 'New', vi: 'Moi' },
        clearDescription: undefined,
      }),
      expect.any(String),
    );
  });

  it('PATCH /admin/products/:id refuses an UNKNOWN field with 400, without reaching the peer', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/products/${newId()}`)
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`)
      .send({ isAvailable: false });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(adminClientStub.updateProduct).not.toHaveBeenCalled();
  });

  it('PUT /admin/products/:id/sizes — 200 with the replaced sizes', async () => {
    const id = newId();
    const sizes = [
      { size: 'S', priceDeltaVnd: 0 },
      { size: 'L', priceDeltaVnd: 10_000 },
    ];
    adminClientStub.replaceSizes.mockResolvedValueOnce({
      product: adminProductProto({ id, sizes }),
    });
    const res = await request(app.getHttpServer())
      .put(`/api/v1/admin/products/${id}/sizes`)
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`)
      .send({ sizes });
    expect(res.status).toBe(200);
    expect(res.body.data.sizes).toEqual(sizes);
    expect(adminClientStub.replaceSizes).toHaveBeenCalledWith({ id, sizes }, expect.any(String));
  });

  it('PUT /admin/products/:id/toppings — 200, then 422 RESOURCE_REFERENCE_INVALID for an unknown topping', async () => {
    const id = newId();
    const toppingIds = [newId()];
    adminClientStub.replaceToppings.mockResolvedValueOnce({
      product: adminProductProto({ id, toppingIds }),
    });
    const ok = await request(app.getHttpServer())
      .put(`/api/v1/admin/products/${id}/toppings`)
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`)
      .send({ toppingIds });
    expect(ok.status).toBe(200);
    expect(ok.body.data.toppingIds).toEqual(toppingIds);
    expect(adminClientStub.replaceToppings).toHaveBeenCalledWith(
      { id, toppingIds },
      expect.any(String),
    );

    adminClientStub.replaceToppings.mockRejectedValueOnce(
      serviceError(21, 'RESOURCE_REFERENCE_INVALID', { field: 'toppingIds' }),
    );
    const bad = await request(app.getHttpServer())
      .put(`/api/v1/admin/products/${id}/toppings`)
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`)
      .send({ toppingIds: [newId()] });
    expect(bad.status).toBe(422);
    expect(bad.body.error.details).toEqual({ field: 'toppingIds' });
  });

  it('POST /admin/products/:id/restore — 200, then 409 INVALID_STATE for a live product', async () => {
    const id = newId();
    adminClientStub.restoreProduct.mockResolvedValueOnce({ product: adminProductProto({ id }) });
    const ok = await request(app.getHttpServer())
      .post(`/api/v1/admin/products/${id}/restore`)
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ id, deletedAt: null });

    adminClientStub.restoreProduct.mockRejectedValueOnce(
      serviceError(9, 'INVALID_STATE', { status: 'LIVE' }),
    );
    const live = await request(app.getHttpServer())
      .post(`/api/v1/admin/products/${id}/restore`)
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`);
    expect(live.status).toBe(409);
    expect(live.body.error).toMatchObject({ code: 'INVALID_STATE', details: { status: 'LIVE' } });
  });

  it('PUT /admin/products/:id/image — hands the peer the bytes, type and extension; null when no URL comes back', async () => {
    const id = newId();
    adminClientStub.setImage.mockResolvedValueOnce({ product: adminProductProto({ id }) });
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const res = await request(app.getHttpServer())
      .put(`/api/v1/admin/products/${id}/image`)
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`)
      .attach('file', bytes, { filename: 'latte.large.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ imageUrl: null });
    expect(adminClientStub.setImage).toHaveBeenCalledWith(
      { id, content: bytes, contentType: 'image/png', extension: 'png' },
      expect.any(String),
    );
  });

  it('GET /admin/toppings?deleted=true — 200 with the deleted toppings', async () => {
    const deletedById = newId();
    adminClientStub.listToppings.mockResolvedValueOnce({
      toppings: [
        {
          id: newId(),
          name: { en: 'Boba', vi: 'Tran chau' },
          priceVnd: 8_000,
          isAvailable: false,
          deletedAt: new Date().toISOString(),
          deletedById,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/toppings?deleted=true')
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].deletedById).toBe(deletedById);
    expect(adminClientStub.listToppings).toHaveBeenCalledWith(
      { deleted: true },
      expect.any(String),
    );
  });

  it('PATCH, DELETE and restore /admin/toppings/:id reach the peer with the id', async () => {
    const id = newId();
    const topping = {
      id,
      name: { en: 'Jelly', vi: 'Thach' },
      priceVnd: 6_000,
      isAvailable: true,
      createdAt: new Date().toISOString(),
    };
    adminClientStub.updateTopping.mockResolvedValueOnce({
      topping: { ...topping, priceVnd: 7_000 },
    });
    const patched = await request(app.getHttpServer())
      .patch(`/api/v1/admin/toppings/${id}`)
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`)
      .send({ priceVnd: 7_000 });
    expect(patched.status).toBe(200);
    expect(patched.body.data).toMatchObject({ id, priceVnd: 7_000, deletedAt: null });
    expect(adminClientStub.updateTopping).toHaveBeenCalledWith(
      expect.objectContaining({ id, priceVnd: 7_000 }),
      expect.any(String),
    );

    adminClientStub.deleteTopping.mockResolvedValueOnce({ topping });
    const deleted = await request(app.getHttpServer())
      .delete(`/api/v1/admin/toppings/${id}`)
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`);
    expect(deleted.status).toBe(204);
    expect(adminClientStub.deleteTopping).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'USER', role: 'ADMIN' }),
      { id },
      expect.any(String),
    );

    adminClientStub.restoreTopping.mockResolvedValueOnce({ topping });
    const restored = await request(app.getHttpServer())
      .post(`/api/v1/admin/toppings/${id}/restore`)
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`);
    expect(restored.status).toBe(200);
    expect(restored.body.data.id).toBe(id);
  });

  it('GET, PATCH and restore /admin/categories map the peer response', async () => {
    const category = adminCategoryProto();
    adminClientStub.listCategories.mockResolvedValueOnce({ categories: [category] });
    const listed = await request(app.getHttpServer())
      .get('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data).toEqual([
      expect.objectContaining({ id: category.id, deletedAt: null, deletedById: null }),
    ]);

    adminClientStub.updateCategory.mockResolvedValueOnce({
      category: { ...category, isActive: false },
    });
    const patched = await request(app.getHttpServer())
      .patch(`/api/v1/admin/categories/${category.id}`)
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`)
      .send({ isActive: false });
    expect(patched.status).toBe(200);
    expect(patched.body.data.isActive).toBe(false);
    expect(adminClientStub.updateCategory).toHaveBeenCalledWith(
      expect.objectContaining({ id: category.id, isActive: false }),
      expect.any(String),
    );

    adminClientStub.restoreCategory.mockRejectedValueOnce(
      serviceError(6, 'CATEGORY_NAME_TAKEN', { locale: 'vi' }),
    );
    const clash = await request(app.getHttpServer())
      .post(`/api/v1/admin/categories/${category.id}/restore`)
      .set('Authorization', `Bearer ${e2e.tokenFor('ADMIN')}`);
    expect(clash.status).toBe(409);
    expect(clash.body.error).toMatchObject({
      code: 'CATEGORY_NAME_TAKEN',
      details: { locale: 'vi' },
    });
  });
});
