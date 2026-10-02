import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@brewlite/contracts';
import type { Metadata } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import { envSchema } from '../../src/config/env.schema.js';
import { MenuModule } from '../../src/modules/menu/menu.module.js';
import { MenuService } from '../../src/modules/menu/menu.service.js';
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
    imports: [configModule, PrismaModule, MenuModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

async function seedProduct(overrides: { stockQty?: number | null; isAvailable?: boolean } = {}) {
  const category = await prisma.category.create({
    data: { id: newId(), nameEn: 'Coffee', nameVi: 'Cà phê' },
  });
  const topping = await prisma.topping.create({
    data: { id: newId(), nameEn: 'Black pearls', nameVi: 'Trân châu đen', priceVnd: 8_000 },
  });
  const product = await prisma.product.create({
    data: {
      id: newId(),
      categoryId: category.id,
      nameEn: 'Iced milk coffee',
      nameVi: 'Cà phê sữa đá',
      basePriceVnd: 29_000,
      isAvailable: overrides.isAvailable ?? true,
      stockQty: overrides.stockQty ?? null,
      sizes: {
        create: [
          { size: 'S', priceDeltaVnd: 0 },
          { size: 'M', priceDeltaVnd: 6_000 },
        ],
      },
      toppings: { create: [{ toppingId: topping.id }] },
    },
  });
  return { category, product, topping };
}

/**
 * `priceItems` is called in-process here (no gRPC transport), so a refusal arrives as
 * the `RpcException` `rpcError` built, not a client-side `ServiceError` — read its
 * `bl-error-code` / `bl-error-details-bin` metadata directly, the same fields
 * `rpc-error.spec.ts` asserts on the throwing side.
 */
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

describe('PriceItems', () => {
  let app: Awaited<ReturnType<typeof buildModule>>;
  let menu: MenuService;

  beforeAll(async () => {
    app = await buildModule();
    menu = app.get(MenuService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('prices a happy cart with two lines of one counted product', async () => {
    const { product, topping } = await seedProduct({ stockQty: 10 });
    const res = await menu.priceItems({
      lines: [
        { productId: product.id, size: 'S', toppingIds: [topping.id], qty: 2 },
        { productId: product.id, size: 'M', toppingIds: [], qty: 1 },
      ],
    });
    expect(res.lines).toHaveLength(2);
    expect(res.lines[0]).toMatchObject({ unitPriceVnd: 37_000, qty: 2, lineTotalVnd: 74_000 });
    expect(res.lines[1]).toMatchObject({ unitPriceVnd: 35_000, qty: 1, lineTotalVnd: 35_000 });
    expect(res.subtotalVnd).toBe(String(74_000 + 35_000));
  });

  it('refuses PRODUCT_UNAVAILABLE with every unavailable id, deduplicated', async () => {
    const unavailable = await seedProduct({ isAvailable: false });
    const missingId = newId();
    const result = (await grpcError(
      menu.priceItems({
        lines: [
          { productId: unavailable.product.id, size: 'S', toppingIds: [], qty: 1 },
          { productId: missingId, size: 'S', toppingIds: [], qty: 1 },
        ],
      }),
    )) as { code: string; details: { productIds: string[] } };
    expect(result.code).toBe('PRODUCT_UNAVAILABLE');
    expect(result.details.productIds).toEqual([unavailable.product.id, missingId]);
  });

  it('reports OPTION_INVALID for the first bad line (line 2 bad size, line 1 bad topping) at lineIndex 0', async () => {
    const { product } = await seedProduct({ stockQty: 10 });
    const result = (await grpcError(
      menu.priceItems({
        lines: [
          { productId: product.id, size: 'S', toppingIds: [newId()], qty: 1 },
          { productId: product.id, size: 'L', toppingIds: [], qty: 1 },
        ],
      }),
    )) as { code: string; details: { lineIndex: number; reason: string } };
    expect(result.code).toBe('OPTION_INVALID');
    expect(result.details).toEqual({ lineIndex: 0, reason: 'TOPPING' });
  });

  it('refuses a size the product does not offer', async () => {
    const { product } = await seedProduct();
    const result = (await grpcError(
      menu.priceItems({ lines: [{ productId: product.id, size: 'L', toppingIds: [], qty: 1 }] }),
    )) as { code: string; details: { lineIndex: number; reason: string } };
    expect(result.code).toBe('OPTION_INVALID');
    expect(result.details).toEqual({ lineIndex: 0, reason: 'SIZE' });
  });

  it('refuses OUT_OF_STOCK when two lines sum past stock', async () => {
    const { product } = await seedProduct({ stockQty: 2 });
    const result = (await grpcError(
      menu.priceItems({
        lines: [
          { productId: product.id, size: 'S', toppingIds: [], qty: 2 },
          { productId: product.id, size: 'M', toppingIds: [], qty: 1 },
        ],
      }),
    )) as { code: string; details: { products: { productId: string; available: number }[] } };
    expect(result.code).toBe('OUT_OF_STOCK');
    expect(result.details.products).toEqual([{ productId: product.id, available: 2 }]);
  });

  it('refuses VALIDATION_FAILED for a malformed request', async () => {
    const result = (await grpcError(menu.priceItems({ lines: [] }))) as { code: string };
    expect(result.code).toBe('VALIDATION_FAILED');
  });
});
