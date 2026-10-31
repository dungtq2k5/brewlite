import { status as GrpcStatus } from '@grpc/grpc-js';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { compareStrings, newId } from '@brewlite/contracts';
import { rpcError } from '@brewlite/nest-common';
import { AdminOrderGrpcClient } from '../../src/modules/admin-orders/admin-order-grpc.client.js';
import { ReportGrpcClient } from '../../src/modules/admin-reports/report-grpc.client.js';
import { IdentityServiceGrpcClient } from '../../src/modules/auth/identity-service-grpc.client.js';
import { LoyaltyGrpcClient } from '../../src/modules/loyalty/loyalty-grpc.client.js';
import { PaymentServiceGrpcClient } from '../../src/modules/payments/payment-service-grpc.client.js';
import { createE2eApp, type E2eApp } from './support/e2e-app.js';

const ordersStub = { listOrders: vi.fn(), getAdminOrder: vi.fn() };
const paymentsStub = { listPaymentsForOrder: vi.fn() };
const reportStub = { salesReport: vi.fn(), getStaffStats: vi.fn() };
const identityStub = { getUser: vi.fn() };
const loyaltyStub = { getLoyaltyForUser: vi.fn() };

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

describe('gateway e2e — /admin/orders, /admin/reports and /admin/users/:id activity', () => {
  let app: NestExpressApplication;
  let e2e: E2eApp;

  beforeAll(async () => {
    e2e = await createE2eApp([
      [AdminOrderGrpcClient, ordersStub],
      [PaymentServiceGrpcClient, paymentsStub],
      [ReportGrpcClient, reportStub],
      [IdentityServiceGrpcClient, identityStub],
      [LoyaltyGrpcClient, loyaltyStub],
    ]);
    app = e2e.app;
  });

  afterEach(() => {
    for (const stub of [ordersStub, paymentsStub, reportStub, identityStub, loyaltyStub]) {
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
      `/api/v1/admin/users/${newId()}/loyalty`,
      `/api/v1/admin/users/${newId()}/staff-stats?from=2026-10-01&to=2026-10-07`,
    ];

    it.each(routes)('staff and customers are refused %s with 403', async (path) => {
      for (const role of ['STAFF', 'CUSTOMER']) {
        const res = await request(app.getHttpServer()).get(path).set(as(role));
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('PERMISSION_DENIED');
      }
      for (const fn of [
        ...Object.values(ordersStub),
        ...Object.values(reportStub),
        ...Object.values(loyaltyStub),
        ...Object.values(identityStub),
      ]) {
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

    it('hands userId to ordering, and refuses one that is not an id', async () => {
      const userId = newId();
      ordersStub.listOrders.mockResolvedValueOnce({
        orders: [],
        meta: { page: 1, pageSize: 20, total: 0 },
      });
      await request(app.getHttpServer())
        .get(`/api/v1/admin/orders?userId=${userId}`)
        .set(as('ADMIN'))
        .expect(200);
      expect((ordersStub.listOrders.mock.calls[0]![1] as { userId: string }).userId).toBe(userId);

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/orders?userId=nope')
        .set(as('ADMIN'));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(ordersStub.listOrders).toHaveBeenCalledTimes(1);
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

    describe('who did it', () => {
      const customer = newId();
      const staff = newId();
      const history = [
        {
          toStatus: 'PENDING',
          actorType: 'CUSTOMER',
          actorUserId: customer,
          createdAt: '2026-10-01T05:00:00Z',
        },
        { toStatus: 'PAID', actorType: 'PAYMENT', createdAt: '2026-10-01T05:01:00Z' },
        {
          toStatus: 'PREPARING',
          actorType: 'STAFF',
          actorUserId: staff,
          createdAt: '2026-10-01T05:02:00Z',
        },
        {
          toStatus: 'READY',
          actorType: 'STAFF',
          actorUserId: staff,
          createdAt: '2026-10-01T05:03:00Z',
        },
        { toStatus: 'CANCELLED', actorType: 'SYSTEM', createdAt: '2026-10-01T05:04:00Z' },
      ];
      const names: Record<string, string> = { [customer]: 'Lan Anh', [staff]: 'Minh Chau' };
      const get = async (order = orderProto({ history })) => {
        ordersStub.getAdminOrder.mockResolvedValueOnce({ order });
        return request(app.getHttpServer())
          .get(`/api/v1/admin/orders/${order.id}`)
          .set(as('ADMIN'));
      };
      const paymentsOk = () =>
        paymentsStub.listPaymentsForOrder.mockResolvedValue({ payments: [] });
      const down = (code: number) => Object.assign(new Error('down'), { code });

      it('gives each row its actor’s id and name, null for SYSTEM and PAYMENT, one lookup per user', async () => {
        paymentsOk();
        identityStub.getUser.mockImplementation((_caller: unknown, { id }: { id: string }) =>
          Promise.resolve({ user: { id, fullName: names[id] } }),
        );
        const res = await get();
        expect(res.status).toBe(200);
        expect(res.body.meta).toBeUndefined();
        expect(
          res.body.data.history.map((h: Record<string, unknown>) => [
            h.actorType,
            h.actorUserId,
            h.actorName,
          ]),
        ).toEqual([
          ['CUSTOMER', customer, 'Lan Anh'],
          ['PAYMENT', null, null],
          ['STAFF', staff, 'Minh Chau'],
          ['STAFF', staff, 'Minh Chau'],
          ['SYSTEM', null, null],
        ]);
        expect(identityStub.getUser).toHaveBeenCalledTimes(2); // the staff member once
      });

      it.each([
        ['UNAVAILABLE', GrpcStatus.UNAVAILABLE],
        ['DEADLINE_EXCEEDED', GrpcStatus.DEADLINE_EXCEEDED],
      ])('identity %s: 200, every actorName null, meta.degraded has identity', async (_n, code) => {
        paymentsOk();
        identityStub.getUser.mockRejectedValue(down(code));
        const res = await get();
        expect(res.status).toBe(200);
        expect(res.body.meta).toEqual({ degraded: ['identity'] });
        expect(
          res.body.data.history.every((h: { actorName: unknown }) => h.actorName === null),
        ).toBe(true);
        expect(res.body.data.history[0].actorUserId).toBe(customer); // the id still shows
      });

      it('identity and payment both down: both are named', async () => {
        paymentsStub.listPaymentsForOrder.mockRejectedValue(down(GrpcStatus.UNAVAILABLE));
        identityStub.getUser.mockRejectedValue(down(GrpcStatus.UNAVAILABLE));
        const res = await get();
        expect(res.status).toBe(200);
        expect(res.body.data.payments).toBeNull();
        expect([...res.body.meta.degraded].sort(compareStrings)).toEqual(['identity', 'payment']);
      });

      it('a user identity no longer finds is null for that id only', async () => {
        paymentsOk();
        identityStub.getUser.mockImplementation((_caller: unknown, { id }: { id: string }) =>
          id === staff
            ? Promise.reject(down(GrpcStatus.NOT_FOUND))
            : Promise.resolve({ user: { id, fullName: names[id] } }),
        );
        const res = await get();
        expect(res.status).toBe(200);
        expect(res.body.meta).toBeUndefined();
        expect(res.body.data.history.map((h: { actorName: unknown }) => h.actorName)).toEqual([
          'Lan Anh',
          null,
          null,
          null,
          null,
        ]);
      });

      it('any other identity error is a real error', async () => {
        paymentsOk();
        identityStub.getUser.mockRejectedValue(down(GrpcStatus.INVALID_ARGUMENT));
        const res = await get();
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(res.body.meta).toBeUndefined();
      });

      it('asks identity for nothing when no row has a user', async () => {
        paymentsOk();
        const res = await get(orderProto({ history: [history[1], history[4]] }));
        expect(res.status).toBe(200);
        expect(identityStub.getUser).not.toHaveBeenCalled();
      });
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

  describe('GET /admin/users/:id/loyalty', () => {
    it('answers the ledger for that user, asking ordering with the id', async () => {
      const userId = newId();
      loyaltyStub.getLoyaltyForUser.mockResolvedValueOnce({
        balance: 12,
        lifetimeEarned: 30,
        recent: [
          {
            orderId: newId(),
            orderNo: '1042',
            kind: 'EARN',
            points: 5,
            at: '2026-10-01T05:00:00Z',
          },
        ],
      });
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/users/${userId}/loyalty`)
        .set(as('ADMIN'));
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ balance: 12, lifetimeEarned: 30 });
      expect(res.body.data.recent[0]).toMatchObject({ orderNo: '1042', kind: 'EARN', points: 5 });
      expect(loyaltyStub.getLoyaltyForUser.mock.calls[0]![1]).toEqual({ userId });
      expect(identityStub.getUser).not.toHaveBeenCalled(); // the gateway does not check the user exists
    });

    it('a malformed id is 400', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/users/nope/loyalty')
        .set(as('ADMIN'));
      expect(res.status).toBe(400);
      expect(loyaltyStub.getLoyaltyForUser).not.toHaveBeenCalled();
    });
  });

  describe('GET /admin/users/:id/staff-stats', () => {
    const path = (userId: string, query: string) =>
      `/api/v1/admin/users/${userId}/staff-stats?${query}`;

    it('answers the counts with the status keys the API documents', async () => {
      const userId = newId();
      reportStub.getStaffStats.mockResolvedValueOnce({
        from: '2026-10-01',
        to: '2026-10-07',
        ordersHandled: 4,
        transitions: { preparing: 4, ready: 3, completed: 2, cancelled: 1 },
      });
      const res = await request(app.getHttpServer())
        .get(path(userId, 'from=2026-10-01&to=2026-10-07'))
        .set(as('ADMIN'));
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        from: '2026-10-01',
        to: '2026-10-07',
        ordersHandled: 4,
        transitions: { PREPARING: 4, READY: 3, COMPLETED: 2, CANCELLED: 1 },
      });
      expect(reportStub.getStaffStats.mock.calls[0]![1]).toEqual({
        userId,
        from: '2026-10-01',
        to: '2026-10-07',
      });
    });

    it.each([
      ['more than 93 days', 'from=2026-07-01&to=2026-10-02'],
      ['from after to', 'from=2026-10-02&to=2026-10-01'],
      ['a missing to', 'from=2026-10-01'],
      ['an unknown parameter', 'from=2026-10-01&to=2026-10-02&x=1'],
    ])('refuses %s with 400 VALIDATION_FAILED', async (_name, query) => {
      const res = await request(app.getHttpServer()).get(path(newId(), query)).set(as('ADMIN'));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(reportStub.getStaffStats).not.toHaveBeenCalled();
    });

    it('a malformed user id is 400', async () => {
      const res = await request(app.getHttpServer())
        .get(path('nope', 'from=2026-10-01&to=2026-10-02'))
        .set(as('ADMIN'));
      expect(res.status).toBe(400);
      expect(reportStub.getStaffStats).not.toHaveBeenCalled();
    });
  });
});
