import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Transport, type MicroserviceOptions } from '@nestjs/microservices';
import type { Metadata } from '@grpc/grpc-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId, Role } from '@brewlite/contracts';
import { ORDERING_PROTO_FILES, PROTO_ROOT } from '@brewlite/contracts/proto-paths.js';
import {
  BaseGrpcClient,
  OutboxService,
  PROTO_LOADER_OPTIONS,
  type Caller,
} from '@brewlite/nest-common';
import type {
  GetAdminOrderRequest,
  GetAdminOrderResponse,
  ListOrdersRequest,
  ListOrdersResponse,
} from '@brewlite/contracts/generated/brewlite/ordering/admin_order_service.js';
import type {
  SalesReportRequest,
  SalesReportResponse,
} from '@brewlite/contracts/generated/brewlite/ordering/report_service.js';
import { envSchema } from '../../src/config/env.schema.js';
import { AdminOrderGrpcController } from '../../src/modules/admin-orders/admin-order-grpc.controller.js';
import { AdminOrdersService } from '../../src/modules/admin-orders/admin-orders.service.js';
import { LoyaltyModule } from '../../src/modules/loyalty/loyalty.module.js';
import { CatalogMenuGrpcClient } from '../../src/modules/orders/catalog-menu-grpc.client.js';
import { CatalogStockGrpcClient } from '../../src/modules/orders/catalog-stock-grpc.client.js';
import { OrdersService } from '../../src/modules/orders/orders.service.js';
import { PrismaModule } from '../../src/modules/prisma/prisma.module.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { PromotionsModule } from '../../src/modules/promotions/promotions.module.js';
import { ReportGrpcController } from '../../src/modules/reports/report-grpc.controller.js';
import { ReportsService } from '../../src/modules/reports/reports.service.js';
import { testEnv } from '../setup/env.js';

const configModule = ConfigModule.forRoot({
  isGlobal: true,
  validate: () => envSchema.parse({ ...testEnv, DATABASE_URL: testEnv.DATABASE_URL_TEST }),
});

// The admin services never call catalog; these only satisfy OrdersService's constructor.
@Module({
  imports: [configModule, PrismaModule, PromotionsModule, LoyaltyModule],
  controllers: [AdminOrderGrpcController, ReportGrpcController],
  providers: [
    OrdersService,
    OutboxService,
    AdminOrdersService,
    ReportsService,
    { provide: CatalogMenuGrpcClient, useValue: {} },
    { provide: CatalogStockGrpcClient, useValue: {} },
  ],
})
class RealAdminOrderModule {}

const caller: Caller = { kind: 'USER', userId: newId(), role: Role.ADMIN };

class TestAdminOrderClient extends BaseGrpcClient {
  constructor(url: string) {
    super({
      serviceName: 'brewlite.ordering.AdminOrderService',
      protoFiles: ORDERING_PROTO_FILES,
      includeDirs: [PROTO_ROOT],
      url,
    });
  }
  listOrders(request: ListOrdersRequest): Promise<ListOrdersResponse> {
    return this.call('listOrders', request, { caller });
  }
  getAdminOrder(request: GetAdminOrderRequest): Promise<GetAdminOrderResponse> {
    return this.call('getAdminOrder', request, { caller });
  }
}

class TestReportClient extends BaseGrpcClient {
  constructor(url: string) {
    super({
      serviceName: 'brewlite.ordering.ReportService',
      protoFiles: ORDERING_PROTO_FILES,
      includeDirs: [PROTO_ROOT],
      url,
    });
  }
  salesReport(request: SalesReportRequest): Promise<SalesReportResponse> {
    return this.call('salesReport', request, { caller });
  }
}

const codeOf = (error: unknown) =>
  (error as { metadata: Metadata }).metadata.get('bl-error-code')[0];

describe('AdminOrderService and ReportService gRPC contract', () => {
  const url = 'localhost:25093';
  let app: Awaited<ReturnType<typeof NestFactory.createMicroservice>>;
  let orders: TestAdminOrderClient;
  let reports: TestReportClient;

  const seedOrder = (overrides: Record<string, unknown> = {}) =>
    app.get(PrismaService).order.create({
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

  beforeAll(async () => {
    app = await NestFactory.createMicroservice<MicroserviceOptions>(RealAdminOrderModule, {
      transport: Transport.GRPC,
      options: {
        package: 'brewlite.ordering',
        protoPath: ORDERING_PROTO_FILES,
        url,
        loader: { ...PROTO_LOADER_OPTIONS, includeDirs: [PROTO_ROOT] },
      },
    });
    await app.listen();
    orders = new TestAdminOrderClient(url);
    reports = new TestReportClient(url);
  });

  afterAll(async () => {
    await app.close();
  });

  it('completes a real ListOrders round trip, with a number filter and a page meta', async () => {
    const order = await seedOrder();
    const res = await orders.listOrders({
      page: { page: 1, pageSize: 20, sort: '-createdAt' },
      orderNo: order.orderNo.toString(),
    });
    expect(res.orders.map((o) => o.id)).toEqual([order.id]);
    expect(res.meta).toEqual({ page: 1, pageSize: 20, total: 1 });
  });

  it('completes a real GetAdminOrder round trip, and carries cancelledAt', async () => {
    const cancelledAt = new Date('2026-10-02T05:00:00Z');
    const order = await seedOrder({
      status: 'CANCELLED',
      cancelledAt,
      cancelReason: 'STAFF',
    });
    const res = await orders.getAdminOrder({ id: order.id });
    expect(res.order?.id).toBe(order.id);
    expect(res.order?.cancelledAt).toBe(cancelledAt.toISOString());
  });

  it('answers RESOURCE_NOT_FOUND for an unknown order, over the wire', async () => {
    await expect(orders.getAdminOrder({ id: newId() })).rejects.toSatisfy(
      (error) => codeOf(error) === 'RESOURCE_NOT_FOUND',
    );
  });

  it('answers VALIDATION_FAILED for a bad filter, over the wire', async () => {
    await expect(
      orders.listOrders({ page: { page: 1, pageSize: 20, sort: 'email' } }),
    ).rejects.toSatisfy((error) => codeOf(error) === 'VALIDATION_FAILED');
  });

  it('completes a real SalesReport round trip: zero days filled, int64 as strings', async () => {
    const res = await reports.salesReport({ from: '2026-01-01', to: '2026-01-03' });
    expect(res.days).toEqual([
      { day: '2026-01-01', orders: 0, revenueVnd: '0' },
      { day: '2026-01-02', orders: 0, revenueVnd: '0' },
      { day: '2026-01-03', orders: 0, revenueVnd: '0' },
    ]);
    expect(res.topProducts).toEqual([]);
  });

  it('answers VALIDATION_FAILED for a range over 93 days, over the wire', async () => {
    await expect(reports.salesReport({ from: '2026-01-01', to: '2026-12-31' })).rejects.toSatisfy(
      (error) => codeOf(error) === 'VALIDATION_FAILED',
    );
  });
});
