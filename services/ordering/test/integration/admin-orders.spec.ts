import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Metadata } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CancelReason, compareStrings, newId, OrderStatus, Role } from '@brewlite/contracts';
import type { Caller } from '@brewlite/nest-common';
import { envSchema } from '../../src/config/env.schema.js';
import { AdminOrdersModule } from '../../src/modules/admin-orders/admin-orders.module.js';
import { AdminOrdersService } from '../../src/modules/admin-orders/admin-orders.service.js';
import { OrdersModule } from '../../src/modules/orders/orders.module.js';
import { OrdersService } from '../../src/modules/orders/orders.service.js';
import { PrismaModule } from '../../src/modules/prisma/prisma.module.js';
import { prisma } from '../setup/per-file.js';
import { testEnv } from '../setup/env.js';

async function buildModule() {
  const configModule = ConfigModule.forRoot({
    isGlobal: true,
    validate: () => envSchema.parse({ ...testEnv, DATABASE_URL: testEnv.DATABASE_URL_TEST }),
  });
  const moduleRef = await Test.createTestingModule({
    imports: [configModule, PrismaModule, OrdersModule, AdminOrdersModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

function errorCode(exception: unknown): string | undefined {
  if (!(exception && typeof exception === 'object' && 'getError' in exception)) return undefined;
  const { metadata } = (exception as RpcException).getError() as { metadata: Metadata };
  return metadata.get('bl-error-code')[0] as string | undefined;
}

async function seedOrder(overrides: Record<string, unknown> = {}) {
  return prisma.order.create({
    data: {
      id: newId(),
      userId: newId(),
      subtotalVnd: 50_000,
      totalVnd: 50_000,
      idempotencyKey: newId(),
      requestHash: 'x'.repeat(64),
      expiresAt: new Date(Date.now() + 900_000),
      ...overrides,
    },
  });
}

const page = (over: Partial<{ page: number; pageSize: number; sort: string }> = {}) => ({
  page: 1,
  pageSize: 20,
  sort: '-createdAt',
  ...over,
});

describe('AdminOrdersService', () => {
  let app: Awaited<ReturnType<typeof buildModule>>;
  let admin: AdminOrdersService;
  let orders: OrdersService;

  beforeAll(async () => {
    app = await buildModule();
    admin = app.get(AdminOrdersService);
    orders = app.get(OrdersService);
  });

  afterAll(async () => {
    await app.close();
  });

  const ids = async (request: Parameters<AdminOrdersService['listOrders']>[0]) =>
    (await admin.listOrders(request)).orders.map((o) => o.id);

  describe('ListOrders', () => {
    it('lists every customer’s orders, newest first, with the total', async () => {
      const a = await seedOrder({ createdAt: new Date('2026-10-01T05:00:00Z') });
      const b = await seedOrder({ createdAt: new Date('2026-10-02T05:00:00Z') });
      const c = await seedOrder({ createdAt: new Date('2026-10-03T05:00:00Z') });
      const response = await admin.listOrders({ page: page() });
      expect(response.orders.map((o) => o.id)).toEqual([c.id, b.id, a.id]);
      expect(response.meta).toEqual({ page: 1, pageSize: 20, total: 3 });
    });

    it('each order carries its lines and no history, like /orders/me', async () => {
      const order = await seedOrder();
      await prisma.orderItem.create({
        data: {
          id: newId(),
          orderId: order.id,
          lineNo: 1,
          productId: newId(),
          productNameEn: 'Latte',
          productNameVi: 'Latte',
          size: 'M',
          basePriceVnd: 49_000,
          sizeDeltaVnd: 0,
          unitPriceVnd: 49_000,
          qty: 2,
          lineTotalVnd: 98_000,
        },
      });
      await prisma.orderStatusHistory.create({
        data: {
          id: newId(),
          orderId: order.id,
          toStatus: 'PENDING',
          actorType: 'CUSTOMER',
          actorUserId: order.userId,
        },
      });
      const [listed] = (await admin.listOrders({ page: page() })).orders;
      expect(listed!.lines).toHaveLength(1);
      expect(listed!.lines[0]).toMatchObject({ qty: 2, lineTotalVnd: 98_000 });
      expect(listed!.history).toEqual([]);
    });

    it('filters by status — every one of the seven is reachable', async () => {
      for (const status of Object.values(OrderStatus)) {
        // The table's CHECK ties CANCELLED to a time and a reason (O-1).
        const cancelled =
          status === OrderStatus.CANCELLED
            ? { cancelledAt: new Date(), cancelReason: CancelReason.CUSTOMER }
            : {};
        const order = await seedOrder({ status, ...cancelled });
        expect(await ids({ page: page(), status })).toEqual([order.id]);
      }
    });

    it('filters by business day, inclusive, in Vietnam time', async () => {
      const lastOfNine = await seedOrder({ createdAt: new Date('2026-09-30T16:59:59Z') }); // 30 Sep VN
      const firstOfTen = await seedOrder({ createdAt: new Date('2026-09-30T17:00:00Z') }); // 1 Oct VN
      const lastOfTen = await seedOrder({ createdAt: new Date('2026-10-31T16:59:59Z') }); // 31 Oct VN
      const firstOfEleven = await seedOrder({ createdAt: new Date('2026-10-31T17:00:00Z') }); // 1 Nov VN

      expect(await ids({ page: page(), from: '2026-10-01', to: '2026-10-31' })).toEqual([
        lastOfTen.id,
        firstOfTen.id,
      ]);
      expect(await ids({ page: page(), from: '2026-11-01' })).toEqual([firstOfEleven.id]);
      expect(await ids({ page: page(), to: '2026-09-30' })).toEqual([lastOfNine.id]);
    });

    it('finds one order by its number, or none', async () => {
      await seedOrder();
      const wanted = await seedOrder();
      expect(await ids({ page: page(), orderNo: wanted.orderNo.toString() })).toEqual([wanted.id]);
      expect(await ids({ page: page(), orderNo: '999999999' })).toEqual([]);
    });

    it('combines filters with AND', async () => {
      const hit = await seedOrder({
        status: OrderStatus.COMPLETED,
        createdAt: new Date('2026-10-10T05:00:00Z'),
      });
      await seedOrder({
        status: OrderStatus.COMPLETED,
        createdAt: new Date('2026-08-10T05:00:00Z'),
      });
      await seedOrder({ status: OrderStatus.PAID, createdAt: new Date('2026-10-10T05:00:00Z') });
      expect(
        await ids({
          page: page(),
          status: OrderStatus.COMPLETED,
          from: '2026-10-01',
          to: '2026-10-31',
        }),
      ).toEqual([hit.id]);
    });

    it('sorts by total, either way, with the id as the tie-break', async () => {
      const cheap = await seedOrder({ totalVnd: 20_000, subtotalVnd: 20_000 });
      const twinA = await seedOrder({ totalVnd: 40_000, subtotalVnd: 40_000 });
      const twinB = await seedOrder({ totalVnd: 40_000, subtotalVnd: 40_000 });
      const [first, second] = [twinA.id, twinB.id].sort(compareStrings);
      expect(await ids({ page: page({ sort: 'totalVnd' }) })).toEqual([cheap.id, first, second]);
      expect(await ids({ page: page({ sort: '-totalVnd' }) })).toEqual([first, second, cheap.id]);
    });

    it('pages: page 2 holds the rest, total counts them all', async () => {
      for (let i = 0; i < 5; i++) {
        await seedOrder({ createdAt: new Date(`2026-10-0${i + 1}T05:00:00Z`) });
      }
      const second = await admin.listOrders({ page: page({ page: 2, pageSize: 2 }) });
      expect(second.orders).toHaveLength(2);
      expect(second.meta).toEqual({ page: 2, pageSize: 2, total: 5 });
      const third = await admin.listOrders({ page: page({ page: 3, pageSize: 2 }) });
      expect(third.orders).toHaveLength(1);
    });

    it.each([
      ['an unknown sort', { page: page({ sort: 'email' }) }],
      ['a page size over the cap', { page: page({ pageSize: 101 }) }],
      ['an unknown status', { page: page(), status: 'DONE' }],
      ['a day that does not exist', { page: page(), from: '2026-02-30' }],
      ['from after to', { page: page(), from: '2026-10-02', to: '2026-10-01' }],
      ['an order number that is not a number', { page: page(), orderNo: 'abc' }],
      ['a zero order number', { page: page(), orderNo: '0' }],
    ])('refuses %s with VALIDATION_FAILED', async (_name, request) => {
      const error = await admin.listOrders(request).catch((e: unknown) => e);
      expect(errorCode(error)).toBe('VALIDATION_FAILED');
    });
  });

  describe('GetAdminOrder', () => {
    it('returns the order with its history, whoever owns it', async () => {
      const order = await seedOrder();
      await prisma.orderStatusHistory.create({
        data: {
          id: newId(),
          orderId: order.id,
          toStatus: 'PENDING',
          actorType: 'CUSTOMER',
          actorUserId: order.userId,
        },
      });
      const { order: found } = await admin.getAdminOrder({ id: order.id });
      expect(found!.id).toBe(order.id);
      expect(found!.history).toHaveLength(1);
    });

    it('is RESOURCE_NOT_FOUND for an unknown id', async () => {
      const error = await admin.getAdminOrder({ id: newId() }).catch((e: unknown) => e);
      expect(errorCode(error)).toBe('RESOURCE_NOT_FOUND');
    });
  });

  describe('cancelledAt', () => {
    it('is set by a cancel and absent on any other order', async () => {
      const order = await seedOrder();
      const caller: Caller = { kind: 'USER', userId: order.userId, role: Role.CUSTOMER };
      const before = await orders.getOrder({ id: order.id }, caller);
      expect(before.order?.cancelledAt).toBeUndefined();

      await orders.cancelOrder({ id: order.id }, caller);
      const after = await orders.getOrder({ id: order.id }, caller);
      expect(after.order?.status).toBe(OrderStatus.CANCELLED);
      expect(new Date(after.order!.cancelledAt!).getTime()).toBeGreaterThan(Date.now() - 60_000);
    });
  });
});
