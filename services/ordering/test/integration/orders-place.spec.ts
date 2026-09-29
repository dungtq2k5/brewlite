import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Metadata } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { newId, Role } from '@brewlite/contracts';
import type { Caller } from '@brewlite/nest-common';
import { envSchema } from '../../src/config/env.schema.js';
import { CatalogMenuGrpcClient } from '../../src/modules/orders/catalog-menu-grpc.client.js';
import { CatalogStockGrpcClient } from '../../src/modules/orders/catalog-stock-grpc.client.js';
import { OrdersModule } from '../../src/modules/orders/orders.module.js';
import { OrdersService } from '../../src/modules/orders/orders.service.js';
import { PrismaModule } from '../../src/modules/prisma/prisma.module.js';
import { prisma } from '../setup/per-file.js';
import { testEnv } from '../setup/env.js';

function pricedLine(productId: string, priceVnd = 29_000) {
  return {
    productId,
    productName: { en: 'Iced milk coffee', vi: 'Cà phê sữa đá' },
    size: 'S',
    basePriceVnd: priceVnd,
    sizeDeltaVnd: 0,
    toppings: [],
    unitPriceVnd: priceVnd,
    qty: 1,
    lineTotalVnd: priceVnd,
  };
}

function buildCatalogMenuStub() {
  return {
    priceItems: vi.fn().mockImplementation((request: { lines: { productId: string }[] }) => {
      const lines = request.lines.map((l) => pricedLine(l.productId));
      const subtotalVnd = lines.reduce((sum, l) => sum + l.lineTotalVnd, 0);
      return Promise.resolve({ lines, subtotalVnd: String(subtotalVnd) });
    }),
  };
}

function buildCatalogStockStub() {
  return {
    reserveStock: vi.fn().mockResolvedValue({ reservations: [] }),
    releaseStock: vi.fn().mockResolvedValue({ reservations: [] }),
  };
}

async function buildModule(catalogMenu: unknown, catalogStock: unknown) {
  const configModule = ConfigModule.forRoot({
    isGlobal: true,
    validate: () =>
      envSchema.parse({
        ...testEnv,
        DATABASE_URL: testEnv.DATABASE_URL_TEST,
      }),
  });
  const moduleRef = await Test.createTestingModule({
    imports: [configModule, PrismaModule, OrdersModule],
  })
    .overrideProvider(CatalogMenuGrpcClient)
    .useValue(catalogMenu)
    .overrideProvider(CatalogStockGrpcClient)
    .useValue(catalogStock)
    .compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

function errorCodeOf(exception: unknown): string | undefined {
  if (!(exception && typeof exception === 'object' && 'getError' in exception)) return undefined;
  const { metadata } = (exception as RpcException).getError() as { metadata: Metadata };
  return metadata.get('bl-error-code')[0] as string | undefined;
}

function buildRequest(overrides: { note?: string; idempotencyKey?: string } = {}) {
  return {
    items: [{ productId: newId(), size: 'S', toppingIds: [], qty: 1 }],
    promoCode: undefined,
    note: overrides.note,
    idempotencyKey: overrides.idempotencyKey ?? newId(),
  };
}

describe('OrdersService.placeOrder / listMyOrders — real DB, catalog stubbed', () => {
  let app: Awaited<ReturnType<typeof buildModule>>;
  let orders: OrdersService;
  let catalogMenu: ReturnType<typeof buildCatalogMenuStub>;
  let catalogStock: ReturnType<typeof buildCatalogStockStub>;
  const caller: Caller = { kind: 'USER', userId: newId(), role: Role.CUSTOMER };

  beforeAll(async () => {
    catalogMenu = buildCatalogMenuStub();
    catalogStock = buildCatalogStockStub();
    app = await buildModule(catalogMenu, catalogStock);
    orders = app.get(OrdersService);
  });

  afterEach(() => {
    catalogMenu.priceItems.mockClear();
    catalogStock.reserveStock.mockClear();
    catalogStock.releaseStock.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  it('the order-number sequence never yields below 1000 — the idempotent bump in schema-objects.sql', async () => {
    // `beforeEach`'s TRUNCATE … RESTART IDENTITY resets the sequence to its own start
    // value (1) — exercising exactly what schema-objects.sql's bump exists to fix.
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF (SELECT last_value FROM orders_order_no_seq) < 1000 THEN
          PERFORM setval('orders_order_no_seq', 1000, false);
        END IF;
      END $$;
    `);
    const result = await orders.placeOrder(buildRequest(), caller);
    expect(result.created).toBe(true);
    expect(Number(result.order?.orderNo)).toBeGreaterThanOrEqual(1000);
  });

  describe('proof (b): creates ONE order for two requests with the same Idempotency-Key', () => {
    it('sequential — the second call returns the same order, created: false', async () => {
      const request = buildRequest();
      const first = await orders.placeOrder(request, caller);
      expect(first.created).toBe(true);

      const second = await orders.placeOrder(request, caller);
      expect(second.created).toBe(false);
      expect(second.order?.id).toBe(first.order?.id);

      const count = await prisma.order.count({ where: { id: first.order!.id } });
      expect(count).toBe(1);
      expect(catalogStock.reserveStock).toHaveBeenCalledTimes(1);
    });

    it('5 concurrent — one row, every response the same id, the losers released', async () => {
      const request = buildRequest();

      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () => orders.placeOrder(request, caller)),
      );
      const fulfilled = results
        .filter(
          (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof orders.placeOrder>>> =>
            r.status === 'fulfilled',
        )
        .map((r) => r.value);
      // Every request either wins the fast path, wins the DB race, or loses the race and
      // reads the winner back — all 5 settle successfully, pointing at one order.
      expect(fulfilled.length).toBe(5);
      const ids = new Set(fulfilled.map((r) => r.order?.id));
      expect(ids.size).toBe(1);
      expect(fulfilled.filter((r) => r.created).length).toBe(1);

      const [orderId] = ids;
      const count = await prisma.order.count({ where: { id: orderId } });
      expect(count).toBe(1);
    });

    it('the same key with a different body refuses IDEMPOTENCY_KEY_REUSED', async () => {
      const idempotencyKey = newId();
      await orders.placeOrder(buildRequest({ idempotencyKey }), caller);

      const error = await orders
        .placeOrder(buildRequest({ idempotencyKey, note: 'a different note' }), caller)
        .catch((e: unknown) => e);
      expect(errorCodeOf(error)).toBe('IDEMPOTENCY_KEY_REUSED');
    });
  });

  it('the cancel outbox row validates against its own schema', async () => {
    const placed = await orders.placeOrder(buildRequest(), caller);
    await orders.cancelOrder({ id: placed.order!.id }, caller);

    const row = await prisma.outboxEvent.findFirstOrThrow({
      where: { aggregateId: placed.order!.id },
    });
    expect(row.subject).toBe('ordering.order.status_changed');
    const payload = row.payload as Record<string, unknown>;
    expect(payload.to).toBe('CANCELLED');
    expect(payload.cancelReason).toBe('CUSTOMER');
  });

  it('cursor paging over 3 orders with limit: 1 — newest first, one per page, null on the last', async () => {
    const placedIds: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const result = await orders.placeOrder(buildRequest(), caller);
      placedIds.push(result.order!.id);
    }

    const page1 = await orders.listMyOrders({ limit: 1 }, caller);
    expect(page1.orders).toHaveLength(1);
    expect(page1.orders[0]?.id).toBe(placedIds[2]); // newest first
    expect(page1.nextCursor).toBeTruthy();

    const page2 = await orders.listMyOrders({ limit: 1, cursor: page1.nextCursor }, caller);
    expect(page2.orders[0]?.id).toBe(placedIds[1]);
    expect(page2.nextCursor).toBeTruthy();

    const page3 = await orders.listMyOrders({ limit: 1, cursor: page2.nextCursor }, caller);
    expect(page3.orders[0]?.id).toBe(placedIds[0]);
    expect(page3.nextCursor).toBeUndefined();
  });

  it("GetOrder refuses RESOURCE_NOT_FOUND for someone else's order", async () => {
    const placed = await orders.placeOrder(buildRequest(), caller);
    const otherCaller: Caller = { kind: 'USER', userId: newId(), role: Role.CUSTOMER };
    const error = await orders
      .getOrder({ id: placed.order!.id }, otherCaller)
      .catch((e: unknown) => e);
    expect(errorCodeOf(error)).toBe('RESOURCE_NOT_FOUND');
  });

  it('a total below MIN_PAYABLE_VND refuses ORDER_TOTAL_TOO_LOW', async () => {
    catalogMenu.priceItems.mockResolvedValueOnce({
      lines: [pricedLine(newId(), 1_000)],
      subtotalVnd: '1000',
    });
    const error = await orders.placeOrder(buildRequest(), caller).catch((e: unknown) => e);
    expect(errorCodeOf(error)).toBe('ORDER_TOTAL_TOO_LOW');
  });

  it('a total above MAX_ORDER_TOTAL_VND refuses ORDER_TOTAL_TOO_HIGH', async () => {
    catalogMenu.priceItems.mockResolvedValueOnce({
      lines: [pricedLine(newId(), 6_000_000)],
      subtotalVnd: '6000000',
    });
    const error = await orders.placeOrder(buildRequest(), caller).catch((e: unknown) => e);
    expect(errorCodeOf(error)).toBe('ORDER_TOTAL_TOO_HIGH');
  });

  it('a promoCode refuses PROMO_CODE_INVALID NOT_FOUND — no promotions yet', async () => {
    const request = { ...buildRequest(), promoCode: 'SAVE10' };
    const error = await orders.placeOrder(request, caller).catch((e: unknown) => e);
    expect(errorCodeOf(error)).toBe('PROMO_CODE_INVALID');
  });
});
