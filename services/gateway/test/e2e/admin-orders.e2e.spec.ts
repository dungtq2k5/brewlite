import { status as GrpcStatus } from '@grpc/grpc-js';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { newId } from '@brewlite/contracts';
import { rpcError } from '@brewlite/nest-common';
import { AdminOrderGrpcClient } from '../../src/modules/admin-orders/admin-order-grpc.client.js';
import { ReportGrpcClient } from '../../src/modules/admin-reports/report-grpc.client.js';
import { PaymentServiceGrpcClient } from '../../src/modules/payments/payment-service-grpc.client.js';
import { createE2eApp, type E2eApp } from './support/e2e-app.js';

const ordersStub = { listOrders: vi.fn(), getAdminOrder: vi.fn() };
const paymentsStub = { listPaymentsForOrder: vi.fn() };
const reportStub = { salesReport: vi.fn() };

function orderProto(overrides: Record<string, unknown> = {}) {
  return {
    id: newId(),
    orderNo: '1042',
    status: 'COMPLETED',
    lines: [],
    subtotalVnd: '29000',
    promoDiscountVnd: 0,
    pointsDiscountVnd: 0,
    totalVnd: '29000',
    promoCode: undefined,
    pointsEarnable: 2,
    note: undefined,
    expiresAt: undefined,
    paidAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    cancelReason: undefined,
    cancelNote: undefined,
    cancelledAt: undefined,
    refundStatus: 'NONE',
    pointsEarned: 2,
    currentPaymentId: undefined,
    history: [],
    ...overrides,
  };
}

function paymentProto(orderId: string) {
  return {
    id: newId(),
    orderId,
    status: 'SUCCEEDED',
    provider: 'STRIPE',
    amountVnd: '29000',
    method: 'CARD',
    clientSecret: undefined,
    expiresAt: undefined,
    createdAt: new Date().toISOString(),
  };
}

describe('gateway e2e — /admin/orders and /admin/reports', () => {
  let app: NestExpressApplication;
  let e2e: E2eApp;

  beforeAll(async () => {
    e2e = await createE2eApp([
      [AdminOrderGrpcClient, ordersStub],
      [PaymentServiceGrpcClient, paymentsStub],
      [ReportGrpcClient, reportStub],
    ]);
    app = e2e.app;
  });

  afterEach(() => {
    for (const stub of [ordersStub, paymentsStub, reportStub]) {
      for (const fn of Object.values(stub)) fn.mockReset();
    }
  });

  afterAll(async () => {
    await e2e.close();
  });

  const as = (role: string) => ({ Authorization: `Bearer ${e2e.tokenFor(role)}` });

  describe('permissions', () => {
    const routes = [
      `/api/v1/admin/orders`,
      `/api/v1/admin/orders/${newId()}`,
      `/api/v1/admin/reports/sales?from=2026-10-01&to=2026-10-07`,
    ];

    it.each(routes)('staff and customers are refused %s with 403', async (path) => {
      for (const role of ['STAFF', 'CUSTOMER']) {
        const res = await request(app.getHttpServer()).get(path).set(as(role));
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('PERMISSION_DENIED');
      }
      for (const fn of [...Object.values(ordersStub), ...Object.values(reportStub)]) {
        expect(fn).not.toHaveBeenCalled();
      }
    });

    it.each(routes)('a guest is refused %s with 401', async (path) => {
      expect((await request(app.getHttpServer()).get(path)).status).toBe(401);
    });
  });

  describe('GET /admin/orders', () => {
    it('hands the filters to ordering and answers { data, meta }', async () => {
      ordersStub.listOrders.mockResolvedValueOnce({
        orders: [orderProto()],
        meta: { page: 1, pageSize: 20, total: 1 },
      });
      const res = await request(app.getHttpServer())
        .get(
          '/api/v1/admin/orders?status=COMPLETED&from=2026-10-01&to=2026-10-31&sort=-totalVnd&page=1&pageSize=20&orderNo=1042',
        )
        .set(as('ADMIN'));
      expect(res.status).toBe(200);
      expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 1 });
      expect(res.body.data[0]).toMatchObject({ orderNo: '1042', cancelledAt: null, history: [] });
      const [, sent] = ordersStub.listOrders.mock.calls[0] as [unknown, Record<string, unknown>];
      expect(sent).toEqual({
        page: { page: 1, pageSize: 20, sort: '-totalVnd' },
        status: 'COMPLETED',
        from: '2026-10-01',
        to: '2026-10-31',
        orderNo: '1042',
      });
    });

    it('defaults to the newest first', async () => {
      ordersStub.listOrders.mockResolvedValueOnce({
        orders: [],
        meta: { page: 1, pageSize: 20, total: 0 },
      });
      await request(app.getHttpServer()).get('/api/v1/admin/orders').set(as('ADMIN')).expect(200);
      const [, sent] = ordersStub.listOrders.mock.calls[0] as [unknown, { page: { sort: string } }];
      expect(sent.page.sort).toBe('-createdAt');
    });

    it.each([
      ['an unknown status', 'status=DONE'],
      ['a sort by something else', 'sort=email'],
      ['a day that does not exist', 'from=2026-02-30'],
      ['from after to', 'from=2026-10-02&to=2026-10-01'],
      ['a zero order number', 'orderNo=0'],
      ['an order number that is not a number', 'orderNo=abc'],
      ['an unknown parameter', 'q=latte'],
    ])('refuses %s with 400 VALIDATION_FAILED', async (_name, query) => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/orders?${query}`)
        .set(as('ADMIN'));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(ordersStub.listOrders).not.toHaveBeenCalled();
    });
  });

  describe('GET /admin/orders/:id', () => {
    it('composes the order with its payments', async () => {
      const order = orderProto();
      ordersStub.getAdminOrder.mockResolvedValueOnce({ order });
      paymentsStub.listPaymentsForOrder.mockResolvedValueOnce({
        payments: [paymentProto(order.id)],
      });
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/orders/${order.id}`)
        .set(as('ADMIN'));
      expect(res.status).toBe(200);
      expect(res.body.meta).toBeUndefined();
      expect(res.body.data.id).toBe(order.id);
      expect(res.body.data.payments).toHaveLength(1);
      expect(res.body.data.payments[0]).toMatchObject({ status: 'SUCCEEDED', clientSecret: null });
    });

    it.each([
      ['UNAVAILABLE', GrpcStatus.UNAVAILABLE],
      ['DEADLINE_EXCEEDED', GrpcStatus.DEADLINE_EXCEEDED],
    ])('payment %s: the order still shows, payments null, meta.degraded', async (_name, code) => {
      const order = orderProto();
      ordersStub.getAdminOrder.mockResolvedValueOnce({ order });
      paymentsStub.listPaymentsForOrder.mockRejectedValueOnce(
        Object.assign(new Error('down'), { code }),
      );
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/orders/${order.id}`)
        .set(as('ADMIN'));
      expect(res.status).toBe(200);
      expect(res.body.data.payments).toBeNull();
      expect(res.body.meta).toEqual({ degraded: ['payment'] });
    });

    it('any other payment error is a real error, not a degraded page', async () => {
      const order = orderProto();
      ordersStub.getAdminOrder.mockResolvedValueOnce({ order });
      paymentsStub.listPaymentsForOrder.mockRejectedValueOnce(
        Object.assign(new Error('bad'), { code: GrpcStatus.INVALID_ARGUMENT }),
      );
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/orders/${order.id}`)
        .set(as('ADMIN'));
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.meta).toBeUndefined();
    });

    it('a missing order is 404 and payment is never asked', async () => {
      ordersStub.getAdminOrder.mockRejectedValueOnce(
        rpcError('RESOURCE_NOT_FOUND', { resource: 'ORDER' }).getError() as object,
      );
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/orders/${newId()}`)
        .set(as('ADMIN'));
      expect(res.status).toBe(404);
      expect(paymentsStub.listPaymentsForOrder).not.toHaveBeenCalled();
    });

    it('a malformed id is 400', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/orders/nope')
        .set(as('ADMIN'));
      expect(res.status).toBe(400);
      expect(ordersStub.getAdminOrder).not.toHaveBeenCalled();
    });
  });

  describe('GET /admin/reports/sales', () => {
    it('answers days and top products with numbers, not strings', async () => {
      reportStub.salesReport.mockResolvedValueOnce({
        days: [{ day: '2026-10-01', orders: 2, revenueVnd: '98000' }],
        topProducts: [
          {
            productId: newId(),
            productName: { en: 'Latte', vi: 'Latte' },
            qty: 3,
            revenueVnd: '147000',
          },
        ],
      });
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/reports/sales?from=2026-10-01&to=2026-10-07')
        .set(as('ADMIN'));
      expect(res.status).toBe(200);
      expect(res.body.data.days).toEqual([{ day: '2026-10-01', orders: 2, revenueVnd: 98000 }]);
      expect(res.body.data.topProducts[0]).toMatchObject({ qty: 3, revenueVnd: 147000 });
      expect(reportStub.salesReport.mock.calls[0]![1]).toEqual({
        from: '2026-10-01',
        to: '2026-10-07',
      });
    });

    it.each([
      ['more than 93 days', 'from=2026-07-01&to=2026-10-02'],
      ['from after to', 'from=2026-10-02&to=2026-10-01'],
      ['a missing to', 'from=2026-10-01'],
      ['a day that does not exist', 'from=2026-02-30&to=2026-03-01'],
      ['an unknown parameter', 'from=2026-10-01&to=2026-10-02&x=1'],
    ])('refuses %s with 400 VALIDATION_FAILED', async (_name, query) => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/reports/sales?${query}`)
        .set(as('ADMIN'));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(reportStub.salesReport).not.toHaveBeenCalled();
    });

    it('accepts exactly 93 days', async () => {
      reportStub.salesReport.mockResolvedValueOnce({ days: [], topProducts: [] });
      await request(app.getHttpServer())
        .get('/api/v1/admin/reports/sales?from=2026-07-01&to=2026-10-01')
        .set(as('ADMIN'))
        .expect(200);
    });
  });
});
