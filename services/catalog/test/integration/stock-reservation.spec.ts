import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@brewlite/contracts';
import type { Metadata } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import { envSchema } from '../../src/config/env.schema.js';
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

function errorCodeOf(exception: unknown): string | undefined {
  if (!(exception && typeof exception === 'object' && 'getError' in exception)) return undefined;
  const { metadata } = (exception as RpcException).getError() as { metadata: Metadata };
  return metadata.get('bl-error-code')[0] as string | undefined;
}

async function seedProduct(stockQty: number | null) {
  const category = await prisma.category.create({
    data: { id: newId(), nameEn: `Cat ${newId()}`, nameVi: `Danh muc ${newId()}` },
  });
  return prisma.product.create({
    data: {
      id: newId(),
      categoryId: category.id,
      nameEn: `P ${newId()}`,
      nameVi: `S ${newId()}`,
      basePriceVnd: 29_000,
      stockQty,
    },
  });
}

describe('StockService — ReserveStock / ReleaseStock', () => {
  let app: Awaited<ReturnType<typeof buildModule>>;
  let stock: StockService;

  beforeAll(async () => {
    app = await buildModule();
    stock = app.get(StockService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('proof (c): never oversells under CONCURRENT orders — K=3, N=10, no HELD row above K', async () => {
    const product = await seedProduct(3);
    const orderIds = Array.from({ length: 10 }, () => newId());

    const results = await Promise.allSettled(
      orderIds.map((orderId) =>
        stock.reserveStock({ orderId, lines: [{ productId: product.id, qty: 1 }] }),
      ),
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(3);
    for (const r of rejected) {
      expect(errorCodeOf((r as PromiseRejectedResult).reason)).toBe('OUT_OF_STOCK');
    }

    const row = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(row.stockQty).toBe(0);

    const heldCount = await prisma.stockReservation.count({ where: { productId: product.id } });
    expect(heldCount).toBe(3);
  });

  it('a mixed two-product race in opposite line order: no deadlock, no STOCK_CONTENDED beyond the retry cap', async () => {
    const a = await seedProduct(20);
    const b = await seedProduct(20);

    const results = await Promise.allSettled([
      stock.reserveStock({
        orderId: newId(),
        lines: [
          { productId: a.id, qty: 1 },
          { productId: b.id, qty: 1 },
        ],
      }),
      stock.reserveStock({
        orderId: newId(),
        lines: [
          { productId: b.id, qty: 1 },
          { productId: a.id, qty: 1 },
        ],
      }),
    ]);
    for (const r of results) expect(r.status).toBe('fulfilled');
  });

  it('ReserveStock twice for one order changes nothing — a retry is a no-op', async () => {
    const product = await seedProduct(5);
    const orderId = newId();

    const first = await stock.reserveStock({ orderId, lines: [{ productId: product.id, qty: 2 }] });
    const second = await stock.reserveStock({
      orderId,
      lines: [{ productId: product.id, qty: 2 }],
    });
    expect(second).toEqual(first);

    const row = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(row.stockQty).toBe(3);
    const count = await prisma.stockReservation.count({ where: { orderId } });
    expect(count).toBe(1);
  });

  it('only counted products get a reservation row', async () => {
    const counted = await seedProduct(5);
    const uncounted = await seedProduct(null);
    const orderId = newId();

    const result = await stock.reserveStock({
      orderId,
      lines: [
        { productId: counted.id, qty: 1 },
        { productId: uncounted.id, qty: 1 },
      ],
    });
    expect(result.reservations).toHaveLength(1);
    expect(result.reservations[0]!.productId).toBe(counted.id);
  });

  it('ReleaseStock returns stock once — a second call finds nothing to release', async () => {
    const product = await seedProduct(5);
    const orderId = newId();
    await stock.reserveStock({ orderId, lines: [{ productId: product.id, qty: 2 }] });

    const first = await stock.releaseStock({ orderId });
    expect(first.reservations).toHaveLength(1);
    expect(first.reservations[0]!.status).toBe('RELEASED');
    const afterFirst = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(afterFirst.stockQty).toBe(5);

    const second = await stock.releaseStock({ orderId });
    expect(second.reservations).toHaveLength(0);
    const afterSecond = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(afterSecond.stockQty).toBe(5);
  });

  it('ReserveStock refuses PRODUCT_UNAVAILABLE for a sold-out-and-deactivated product, naming it', async () => {
    const product = await seedProduct(5);
    await prisma.product.update({ where: { id: product.id }, data: { isAvailable: false } });

    const error = await stock
      .reserveStock({ orderId: newId(), lines: [{ productId: product.id, qty: 1 }] })
      .catch((e: unknown) => e);
    expect(errorCodeOf(error)).toBe('PRODUCT_UNAVAILABLE');
  });
});
