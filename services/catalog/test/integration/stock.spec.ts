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

  it('RESOURCE_NOT_FOUND for an unknown product', async () => {
    const result = (await grpcError(
      stock.setProductAvailability({ id: newId(), isAvailable: false }),
    )) as { code: string };
    expect(result.code).toBe('RESOURCE_NOT_FOUND');
  });
});
