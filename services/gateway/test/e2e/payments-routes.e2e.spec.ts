import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createE2eApp, type E2eApp } from './support/e2e-app.js';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { newId } from '@brewlite/contracts';
import { PaymentServiceGrpcClient } from '../../src/modules/payments/payment-service-grpc.client.js';
import { WebhookServiceGrpcClient } from '../../src/modules/payments/webhook-service-grpc.client.js';

const paymentClientStub = {
  createPayment: vi.fn(),
  getPayment: vi.fn(),
  fakeConfirm: vi.fn(),
};

const webhookClientStub = { handleStripeEvent: vi.fn() };

function paymentProto(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: newId(),
    orderId: newId(),
    status: 'PENDING',
    provider: 'FAKE',
    amountVnd: '29000',
    method: undefined,
    clientSecret: undefined,
    expiresAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('gateway e2e — /payments routes', () => {
  let app: NestExpressApplication;
  let e2e: E2eApp;

  beforeAll(async () => {
    e2e = await createE2eApp([
      [PaymentServiceGrpcClient, paymentClientStub],
      [WebhookServiceGrpcClient, webhookClientStub],
    ]);
    app = e2e.app;
  });

  afterEach(() => {
    for (const fn of Object.values(paymentClientStub)) fn.mockReset();
    webhookClientStub.handleStripeEvent.mockReset();
  });

  afterAll(async () => {
    await e2e.close();
  });

  it('POST /payments with no Idempotency-Key — 400 IDEMPOTENCY_KEY_REQUIRED', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${e2e.tokenFor('CUSTOMER')}`)
      .send({ orderId: newId() });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    expect(paymentClientStub.createPayment).not.toHaveBeenCalled();
  });

  it('POST /payments — 201 when created, 200 when not', async () => {
    paymentClientStub.createPayment.mockResolvedValueOnce({
      payment: paymentProto(),
      created: true,
    });
    const created = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${e2e.tokenFor('CUSTOMER')}`)
      .set('Idempotency-Key', newId())
      .send({ orderId: newId() });
    expect(created.status).toBe(201);

    paymentClientStub.createPayment.mockResolvedValueOnce({
      payment: paymentProto(),
      created: false,
    });
    const replayed = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${e2e.tokenFor('CUSTOMER')}`)
      .set('Idempotency-Key', newId())
      .send({ orderId: newId() });
    expect(replayed.status).toBe(200);
  });

  it('a client-secret field in the body — 400 VALIDATION_FAILED (.strict() refuses it)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${e2e.tokenFor('CUSTOMER')}`)
      .set('Idempotency-Key', newId())
      .send({ orderId: newId(), clientSecret: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(paymentClientStub.createPayment).not.toHaveBeenCalled();
  });

  it('GET /payments/:id with a malformed id — 400 VALIDATION_FAILED', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/payments/not-a-uuid')
      .set('Authorization', `Bearer ${e2e.tokenFor('CUSTOMER')}`);
    expect(res.status).toBe(400);
  });

  it('GET /payments/:id round trip', async () => {
    paymentClientStub.getPayment.mockResolvedValueOnce({ payment: paymentProto() });
    const res = await request(app.getHttpServer())
      .get(`/api/v1/payments/${newId()}`)
      .set('Authorization', `Bearer ${e2e.tokenFor('CUSTOMER')}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PENDING');
  });

  it('POST /payments/:id/fake-confirm round trip', async () => {
    paymentClientStub.fakeConfirm.mockResolvedValueOnce({
      payment: paymentProto({ status: 'SUCCEEDED', method: 'FAKE' }),
    });
    const res = await request(app.getHttpServer())
      .post(`/api/v1/payments/${newId()}/fake-confirm`)
      .set('Authorization', `Bearer ${e2e.tokenFor('CUSTOMER')}`)
      .send({ outcome: 'SUCCEEDED' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('SUCCEEDED');
  });

  it('POST /payments/:id/fake-confirm with a bad outcome — 400 VALIDATION_FAILED', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/payments/${newId()}/fake-confirm`)
      .set('Authorization', `Bearer ${e2e.tokenFor('CUSTOMER')}`)
      .send({ outcome: 'MAYBE' });
    expect(res.status).toBe(400);
    expect(paymentClientStub.fakeConfirm).not.toHaveBeenCalled();
  });

  it('every /payments route refuses a guest with 401', async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/payments/${newId()}`);
    expect(res.status).toBe(401);
  });

  it('fake-confirm is absent from openapi.json', async () => {
    const { buildOpenApiDocument } = await import('@brewlite/nest-common');
    const document = buildOpenApiDocument(app);
    const paths = Object.keys(document.paths ?? {});
    expect(paths.some((p) => p.includes('fake-confirm'))).toBe(false);
    expect(paths.some((p) => p === '/api/v1/payments')).toBe(true);
  });

  describe('POST /api/webhooks/stripe', () => {
    it('passes the raw bytes and the signature through untouched', async () => {
      webhookClientStub.handleStripeEvent.mockResolvedValueOnce({});
      // Key order and whitespace a JSON.parse → stringify round trip would change.
      const body =
        '{ "type":"checkout.session.completed",   "id":"evt_1",\n "data":{"b":1,"a":2} }';
      const res = await request(app.getHttpServer())
        .post('/api/webhooks/stripe')
        .set('Content-Type', 'application/json')
        .set('Stripe-Signature', 't=1,v1=abc')
        .send(body);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ received: true });
      const [call] = webhookClientStub.handleStripeEvent.mock.calls[0] as [
        { payload: Buffer; signature: string },
      ];
      expect(call.payload.toString('utf8')).toBe(body);
      expect(call.signature).toBe('t=1,v1=abc');
    });

    it('no Stripe-Signature header → 400 WEBHOOK_SIGNATURE_INVALID, payment never called', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/webhooks/stripe')
        .set('Content-Type', 'application/json')
        .send('{}');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('WEBHOOK_SIGNATURE_INVALID');
      expect(webhookClientStub.handleStripeEvent).not.toHaveBeenCalled();
    });

    it('is version-neutral — /api/v1/webhooks/stripe does not exist', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/webhooks/stripe')
        .set('Stripe-Signature', 't=1,v1=abc')
        .send({});
      expect(res.status).toBe(404);
    });

    it('is absent from openapi.json', async () => {
      const { buildOpenApiDocument } = await import('@brewlite/nest-common');
      const paths = Object.keys(buildOpenApiDocument(app).paths ?? {});
      expect(paths.some((p) => p.includes('webhooks'))).toBe(false);
    });
  });
});
