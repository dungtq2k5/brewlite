import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createE2eApp, type E2eApp } from './support/e2e-app.js';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { compareStrings, newId } from '@brewlite/contracts';
import { OrderingServiceGrpcClient } from '../../src/modules/orders/ordering-service-grpc.client.js';

const orderingClientStub = {
  quote: vi.fn(),
  placeOrder: vi.fn(),
  listMyOrders: vi.fn(),
  getOrder: vi.fn(),
  cancelOrder: vi.fn(),
};

function orderLineProto() {
  return {
    productId: newId(),
    productName: { en: 'Latte', vi: 'Latte' },
    size: 'S',
    toppings: [],
    unitPriceVnd: 29_000,
    qty: 1,
    lineTotalVnd: 29_000,
  };
}

function orderProto(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: newId(),
    orderNo: '1000',
    status: 'PENDING',
    lines: [orderLineProto()],
    subtotalVnd: '29000',
    promoDiscountVnd: 0,
    pointsDiscountVnd: 0,
    totalVnd: '29000',
    promoCode: undefined,
    pointsEarnable: 2,
    note: undefined,
    expiresAt: new Date().toISOString(),
    paidAt: undefined,
    createdAt: new Date().toISOString(),
    cancelReason: undefined,
    cancelNote: undefined,
    refundStatus: 'NONE',
    pointsEarned: 0,
    pointsRedeemed: 0,
    currentPaymentId: undefined,
    history: [],
    userId: newId(), // ordering sends it; the customer's routes must not pass it on
    ...overrides,
  };
}

describe('gateway e2e — /orders routes', () => {
  let app: NestExpressApplication;
  let e2e: E2eApp;

  beforeAll(async () => {
    e2e = await createE2eApp([[OrderingServiceGrpcClient, orderingClientStub]]);
    app = e2e.app;
  });

  afterEach(() => {
    for (const fn of Object.values(orderingClientStub)) fn.mockReset();
  });

  afterAll(async () => {
    await e2e.close();
  });

  const validBody = {
    items: [{ productId: newId(), size: 'S', toppingIds: [], qty: 1 }],
  };

  it('POST /orders with no Idempotency-Key — 400 IDEMPOTENCY_KEY_REQUIRED', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${e2e.tokenFor('CUSTOMER')}`)
      .send(validBody);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    expect(orderingClientStub.placeOrder).not.toHaveBeenCalled();
  });

  it('POST /orders with a v4 Idempotency-Key — 400 IDEMPOTENCY_KEY_REQUIRED', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${e2e.tokenFor('CUSTOMER')}`)
      .set('Idempotency-Key', '3fa85f64-5717-4562-b3fc-2c963f66afa6') // a v4 UUID
      .send(validBody);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    expect(orderingClientStub.placeOrder).not.toHaveBeenCalled();
  });

  it('POST /orders — 201 when created, 200 when not', async () => {
    orderingClientStub.placeOrder.mockResolvedValueOnce({ order: orderProto(), created: true });
    const created = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${e2e.tokenFor('CUSTOMER')}`)
      .set('Idempotency-Key', newId())
      .send(validBody);
    expect(created.status).toBe(201);

    orderingClientStub.placeOrder.mockResolvedValueOnce({ order: orderProto(), created: false });
    const replayed = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${e2e.tokenFor('CUSTOMER')}`)
      .set('Idempotency-Key', newId())
      .send(validBody);
    expect(replayed.status).toBe(200);
  });

  it('pointsToRedeem is passed to ordering on place; 0, a fraction or a string is 400', async () => {
    orderingClientStub.placeOrder.mockResolvedValueOnce({
      order: orderProto({ pointsRedeemed: 10, pointsDiscountVnd: 10_000 }),
      created: true,
    });
    const ok = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${e2e.tokenFor('CUSTOMER')}`)
      .set('Idempotency-Key', newId())
      .send({ ...validBody, pointsToRedeem: 10 });
    expect(ok.status).toBe(201);
    expect(ok.body.data).toMatchObject({ pointsRedeemed: 10, pointsDiscountVnd: 10_000 });
    expect(orderingClientStub.placeOrder.mock.calls[0]![1]).toMatchObject({ pointsToRedeem: 10 });

    for (const pointsToRedeem of [0, 1.5, '10']) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${e2e.tokenFor('CUSTOMER')}`)
        .set('Idempotency-Key', newId())
        .send({ ...validBody, pointsToRedeem });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    }
    expect(orderingClientStub.placeOrder).toHaveBeenCalledTimes(1);
  });

  it('POST /orders/quote returns the points fields and refuses pointsToRedeem: 0', async () => {
    orderingClientStub.quote.mockResolvedValueOnce({
      lines: [orderLineProto()],
      subtotalVnd: '236000',
      promoDiscountVnd: 0,
      pointsDiscountVnd: 60_000,
      totalVnd: '176000',
      promoCode: undefined,
      pointsEarnable: 17,
      pointsBalance: 60,
      pointsRedeemable: 60,
      pointsCapReason: 'BALANCE',
      pointsRedeemed: 60,
    });
    const res = await request(app.getHttpServer())
      .post('/api/v1/orders/quote')
      .set('Authorization', `Bearer ${e2e.tokenFor('CUSTOMER')}`)
      .send({ ...validBody, pointsToRedeem: 60 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      totalVnd: 176_000,
      pointsBalance: 60,
      pointsRedeemable: 60,
      pointsCapReason: 'BALANCE',
      pointsRedeemed: 60,
    });
    expect(orderingClientStub.quote.mock.calls[0]![1]).toMatchObject({ pointsToRedeem: 60 });

    const zero = await request(app.getHttpServer())
      .post('/api/v1/orders/quote')
      .set('Authorization', `Bearer ${e2e.tokenFor('CUSTOMER')}`)
      .send({ ...validBody, pointsToRedeem: 0 });
    expect(zero.status).toBe(400);
  });

  it('GET /orders/me is not parsed as an order id', async () => {
    orderingClientStub.listMyOrders.mockResolvedValueOnce({
      orders: [orderProto()],
      nextCursor: undefined,
    });
    const res = await request(app.getHttpServer())
      .get('/api/v1/orders/me')
      .set('Authorization', `Bearer ${e2e.tokenFor('CUSTOMER')}`);
    expect(res.status).toBe(200);
    expect(orderingClientStub.listMyOrders).toHaveBeenCalledTimes(1);
    expect(orderingClientStub.getOrder).not.toHaveBeenCalled();
  });

  it('the customer’s own routes never carry their owner (userId is admin-only)', async () => {
    const auth = { Authorization: `Bearer ${e2e.tokenFor('CUSTOMER')}` };
    orderingClientStub.listMyOrders.mockResolvedValueOnce({
      orders: [orderProto()],
      nextCursor: undefined,
    });
    const list = await request(app.getHttpServer()).get('/api/v1/orders/me').set(auth);
    expect(list.status).toBe(200);
    expect(list.body.data[0]).not.toHaveProperty('userId');
    expect(list.body.data[0]).not.toHaveProperty('customerName');

    orderingClientStub.getOrder.mockResolvedValueOnce({ order: orderProto() });
    const one = await request(app.getHttpServer()).get(`/api/v1/orders/${newId()}`).set(auth);
    expect(one.status).toBe(200);
    expect(one.body.data).not.toHaveProperty('userId');
    expect(one.body.data).not.toHaveProperty('customerName');
  });

  it('GET /orders/:id carries currentPaymentId — null before a payment, the id after', async () => {
    const paymentId = newId();
    orderingClientStub.getOrder.mockResolvedValueOnce({ order: orderProto() });
    const before = await request(app.getHttpServer())
      .get(`/api/v1/orders/${newId()}`)
      .set('Authorization', `Bearer ${e2e.tokenFor('CUSTOMER')}`);
    expect(before.status).toBe(200);
    expect(before.body.data.currentPaymentId).toBeNull();

    orderingClientStub.getOrder.mockResolvedValueOnce({
      order: orderProto({ status: 'PAID', currentPaymentId: paymentId }),
    });
    const after = await request(app.getHttpServer())
      .get(`/api/v1/orders/${newId()}`)
      .set('Authorization', `Bearer ${e2e.tokenFor('CUSTOMER')}`);
    expect(after.body.data.currentPaymentId).toBe(paymentId);
  });

  it('GET /orders/:id history says who as a type only — never a user id or a name', async () => {
    orderingClientStub.getOrder.mockResolvedValueOnce({
      order: orderProto({
        history: [
          {
            toStatus: 'PREPARING',
            actorType: 'STAFF',
            actorUserId: newId(), // ordering sends it; this route must not pass it on
            createdAt: '2026-10-01T05:00:00Z',
          },
        ],
      }),
    });
    const res = await request(app.getHttpServer())
      .get(`/api/v1/orders/${newId()}`)
      .set('Authorization', `Bearer ${e2e.tokenFor('CUSTOMER')}`);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data.history[0]).sort(compareStrings)).toEqual([
      'actorType',
      'createdAt',
      'fromStatus',
      'note',
      'toStatus',
    ]);
  });

  it('GET /orders/:id with a malformed id — 400 VALIDATION_FAILED', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/orders/not-a-uuid')
      .set('Authorization', `Bearer ${e2e.tokenFor('CUSTOMER')}`);
    expect(res.status).toBe(400);
  });

  it('POST /orders/:id/cancel round trip', async () => {
    orderingClientStub.cancelOrder.mockResolvedValueOnce({
      order: orderProto({ status: 'CANCELLED', cancelReason: 'CUSTOMER' }),
    });
    const res = await request(app.getHttpServer())
      .post(`/api/v1/orders/${newId()}/cancel`)
      .set('Authorization', `Bearer ${e2e.tokenFor('CUSTOMER')}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CANCELLED');
  });

  it('every /orders route refuses a guest with 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/orders/me');
    expect(res.status).toBe(401);
  });
});
