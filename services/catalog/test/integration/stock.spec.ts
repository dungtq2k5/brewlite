import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { newId } from '@brewlite/contracts';
import type { Metadata } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import { envSchema } from '../../src/config/env.schema.js';
import { MenuCache } from '../../src/modules/menu/menu-cache.service.js';
import { StockModule } from '../../src/modules/stock/stock.module.js';
import { StockService } from '../../src/modules/stock/stock.service.js';
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
        REDIS_URL: testEnv.REDIS_URL_TEST,
      }),
  });
  const moduleRef = await Test.createTestingModule({
    imports: [configModule, PrismaModule, StockModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

function grpcError(promise: Promise<unknown>) {
  return promise.catch((error: unknown) => {
    if (!(error && typeof error === 'object' && 'getError' in error)) throw error;
    const { metadata } = (error as RpcException).getError() as { metadata: Metadata };
    const code = metadata.get('bl-error-code')[0] as string | undefined;
    const [rawDetails] = metadata.get('bl-error-details-bin');
    const details = rawDetails
      ? (JSON.parse(
          Buffer.isBuffer(rawDetails) ? rawDetails.toString('utf8') : String(rawDetails),
        ) as unknown)
      : undefined;
    return { code, details };
  });
}

async function seedProduct(overrides: { stockQty?: number | null } = {}) {
  const category = await prisma.category.create({
    data: { id: newId(), nameEn: 'Coffee', nameVi: 'Cà phê' },
  });
  const product = await prisma.product.create({
    data: {
      id: newId(),
      categoryId: category.id,
      nameEn: 'Iced milk coffee',
      nameVi: 'Cà phê sữa đá',
      basePriceVnd: 29_000,
      stockQty: overrides.stockQty ?? null,
    },
  });
  return { category, product };
}

describe('StockService', () => {
  let app: Awaited<ReturnType<typeof buildModule>>;
  let stock: StockService;
  let cache: MenuCache;

  beforeAll(async () => {
    app = await buildModule();
    stock = app.get(StockService);
    cache = app.get(MenuCache);
  });

  afterAll(async () => {
    await app.close();
  });

  it('SetStockQty concurrently under one expectedVersion: one 200, one STOCK_VERSION_CONFLICT, version +1 exactly once', async () => {
    const { product } = await seedProduct({ stockQty: 10 });

    const results = await Promise.allSettled([
      stock.setStockQty({ id: product.id, stockQty: 5, expectedVersion: 0 }),
      stock.setStockQty({ id: product.id, stockQty: 3, expectedVersion: 0 }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const row = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(row.version).toBe(1);
  });

  it('a stale expectedVersion refuses with the current version and stock', async () => {
    const { product } = await seedProduct({ stockQty: 10 });
    await stock.setStockQty({ id: product.id, stockQty: 7, expectedVersion: 0 });

    const result = (await grpcError(
      stock.setStockQty({ id: product.id, stockQty: 1, expectedVersion: 0 }),
    )) as { code: string; details: { currentVersion: number; currentStockQty: number } };
    expect(result.code).toBe('STOCK_VERSION_CONFLICT');
    expect(result.details).toEqual({ currentVersion: 1, currentStockQty: 7 });
  });

  it('SetProductAvailability never bumps version', async () => {
    const { product } = await seedProduct();
    await stock.setProductAvailability({ id: product.id, isAvailable: false });
    const row = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(row.version).toBe(0);
    expect(row.isAvailable).toBe(false);
  });

  it('every write invalidates the menu cache', async () => {
    const invalidateSpy = vi.spyOn(cache, 'invalidate');
    const { product } = await seedProduct();
    invalidateSpy.mockClear();

    await stock.setProductAvailability({ id: product.id, isAvailable: false });
    expect(invalidateSpy).toHaveBeenCalledTimes(1);

    await stock.setStockQty({ id: product.id, stockQty: 4, expectedVersion: 0 });
    expect(invalidateSpy).toHaveBeenCalledTimes(2);

    invalidateSpy.mockRestore();
  });

  it('ListStaffToppings returns an unavailable topping and omits a soft-deleted one', async () => {
    const make = (nameEn: string, extra: Record<string, unknown> = {}) =>
      prisma.topping.create({
        data: { id: newId(), nameEn, nameVi: nameEn, priceVnd: 8_000, ...extra },
      });
    const available = await make('Boba');
    const switchedOff = await make('Aloe', { isAvailable: false });
    await make('Jelly', { deletedAt: new Date(), deletedById: newId() });

    const { toppings } = await stock.listStaffToppings({});

    expect(toppings.map((t) => t.id)).toEqual([switchedOff.id, available.id]); // by English name
    expect(toppings.find((t) => t.id === switchedOff.id)).toMatchObject({
      isAvailable: false,
      priceVnd: 8_000,
      name: { en: 'Aloe', vi: 'Aloe' },
    });
  });

  it('SetStockQty without a stockQty makes the product UNCOUNTED and bumps version', async () => {
    const { product } = await seedProduct({ stockQty: 10 });
    const result = await stock.setStockQty({ id: product.id, expectedVersion: 0 });
    expect(result.product?.stockQty).toBeUndefined();
    const row = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(row).toMatchObject({ stockQty: null, version: 1 });
  });

  it('SetStockQty on an unknown or soft-deleted product answers RESOURCE_NOT_FOUND, not a conflict', async () => {
    const { product } = await seedProduct({ stockQty: 10 });
    await prisma.product.update({
      where: { id: product.id },
      data: { deletedAt: new Date(), deletedById: newId() },
    });
    for (const id of [product.id, newId()]) {
      const result = await grpcError(stock.setStockQty({ id, stockQty: 1, expectedVersion: 0 }));
      expect(result).toEqual({ code: 'RESOURCE_NOT_FOUND', details: { resource: 'PRODUCT' } });
    }
    const row = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(row).toMatchObject({ stockQty: 10, version: 0 });
  });

  it('SetToppingAvailability switches a live topping and refuses a soft-deleted one', async () => {
    const topping = await prisma.topping.create({
      data: { id: newId(), nameEn: 'Boba', nameVi: 'Tran chau', priceVnd: 8_000 },
    });
    const switched = await stock.setToppingAvailability({ id: topping.id, isAvailable: false });
    expect(switched.topping).toMatchObject({ id: topping.id, isAvailable: false });

    await prisma.topping.update({
      where: { id: topping.id },
      data: { deletedAt: new Date(), deletedById: newId() },
    });
    const result = await grpcError(
      stock.setToppingAvailability({ id: topping.id, isAvailable: true }),
    );
    expect(result).toEqual({ code: 'RESOURCE_NOT_FOUND', details: { resource: 'TOPPING' } });
    const row = await prisma.topping.findUniqueOrThrow({ where: { id: topping.id } });
    expect(row.isAvailable).toBe(false);
  });

  it('ReleaseStock invalidates the menu cache only when stock comes back FROM ZERO', async () => {
    const invalidateSpy = vi.spyOn(cache, 'invalidate');
    const { category, product: partly } = await seedProduct({ stockQty: 5 });
    const soldOut = await prisma.product.create({
      data: {
        id: newId(),
        categoryId: category.id,
        nameEn: 'Peach tea',
        nameVi: 'Trà đào',
        basePriceVnd: 35_000,
        stockQty: 2,
      },
    });
    const partialOrder = newId();
    const soldOutOrder = newId();
    await stock.reserveStock({ orderId: partialOrder, lines: [{ productId: partly.id, qty: 2 }] });
    await stock.reserveStock({ orderId: soldOutOrder, lines: [{ productId: soldOut.id, qty: 2 }] });
    invalidateSpy.mockClear();

    await stock.releaseStock({ orderId: partialOrder });
    expect(invalidateSpy).not.toHaveBeenCalled();

    await stock.releaseStock({ orderId: soldOutOrder });
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    const row = await prisma.product.findUniqueOrThrow({ where: { id: soldOut.id } });
    expect(row.stockQty).toBe(2);

    invalidateSpy.mockRestore();
  });

  it('RESOURCE_NOT_FOUND for an unknown product', async () => {
    const result = (await grpcError(
      stock.setProductAvailability({ id: newId(), isAvailable: false }),
    )) as { code: string };
    expect(result.code).toBe('RESOURCE_NOT_FOUND');
  });
});
