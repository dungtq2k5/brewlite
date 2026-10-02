import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createE2eApp, type E2eApp } from './support/e2e-app.js';
import { Subject } from 'rxjs';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { newId, OrderStatus } from '@brewlite/contracts';
import { rpcError } from '@brewlite/nest-common';
import { OrderingServiceGrpcClient } from '../../src/modules/orders/ordering-service-grpc.client.js';
import { StaffOrdersGrpcClient } from '../../src/modules/staff-orders/staff-orders-grpc.client.js';
import { OrderEventsSource } from '../../src/events/order-events.source.js';
import type { OrderStatusFrame } from '../../src/events/order-status-frame.js';

let e2e: E2eApp;
const token = (role: string, sub?: string) => e2e.tokenFor(role, sub);
const frames = new Subject<OrderStatusFrame>();
const sourceStub = {
  frames$: frames.asObservable(),
  readinessCheck: () => () => Promise.resolve(true),
};
const orderingStub = { getOrder: vi.fn() };
const staffOrdersStub = { listBoard: vi.fn(), advanceStatus: vi.fn(), cancelPaid: vi.fn() };

interface OpenStream {
  status: number;
  contentType: string | undefined;
  text: () => string;
  ended: Promise<void>;
  close: () => void;
}

function openStream(
  app: NestExpressApplication,
  path: string,
  bearer?: string,
): Promise<OpenStream> {
  return new Promise((resolve, reject) => {
    const req = http.get(
      `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}${path}`,
      { headers: bearer ? { Authorization: `Bearer ${bearer}` } : {} },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => (body += chunk));
        const ended = new Promise<void>((done) => {
          res.on('end', done);
          res.on('close', done);
        });
        resolve({
          status: res.statusCode ?? 0,
          contentType: res.headers['content-type'],
          text: () => body,
          ended,
          close: () => req.destroy(),
        });
      },
    );
    req.on('error', reject);
  });
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

function frame(
  orderId: string,
  status: OrderStatus,
  overrides: Partial<OrderStatusFrame> = {},
): OrderStatusFrame {
  return {
    id: newId(),
    orderId,
    orderNo: 1042,
    status,
    at: '2026-09-30T08:15:02.120Z',
    ...overrides,
  };
}

describe('gateway e2e — SSE streams and /staff/orders', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    e2e = await createE2eApp(
      [
        [OrderingServiceGrpcClient, orderingStub],
        [StaffOrdersGrpcClient, staffOrdersStub],
        [OrderEventsSource, sourceStub],
      ],
      { listen: true },
    );
    app = e2e.app;
  });

  afterEach(() => {
    orderingStub.getOrder.mockReset();
    for (const fn of Object.values(staffOrdersStub)) fn.mockReset();
    vi.useRealTimers();
  });

  afterAll(async () => {
    await e2e.close();
  });

  const openOrder = (status: string) => ({ order: { id: newId(), status } });

  it('writes the exact frame text and ends the customer stream after a terminal frame', async () => {
    const orderId = newId();
    orderingStub.getOrder.mockResolvedValueOnce(openOrder('PAID'));
    const stream = await openStream(app, `/api/v1/orders/${orderId}/events`, token('CUSTOMER'));
    expect(stream.status).toBe(200);
    expect(stream.contentType).toBe('text/event-stream');

    const ready = frame(orderId, OrderStatus.READY);
    frames.next(frame(newId(), OrderStatus.READY)); // someone else's order — filtered out
    frames.next(ready);
    await tick();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(stream.text()).toBe(
      `event: order.status\nid: ${ready.id}\ndata: {"orderId":"${orderId}","orderNo":1042,"status":"READY","at":"2026-09-30T08:15:02.120Z"}\n\n`,
    );

    frames.next(frame(orderId, OrderStatus.COMPLETED));
    await stream.ended;
    expect(stream.text()).toContain('"status":"COMPLETED"');
    expect(frames.observed).toBe(false);
  });

  it('a COMPLETED or CANCELLED order at connect answers 204 with no body', async () => {
    for (const status of ['COMPLETED', 'CANCELLED']) {
      orderingStub.getOrder.mockResolvedValueOnce(openOrder(status));
      const res = await request(app.getHttpServer())
        .get(`/api/v1/orders/${newId()}/events`)
        .set('Authorization', `Bearer ${token('CUSTOMER')}`);
      expect(res.status).toBe(204);
      expect(res.text).toBe('');
    }
  });

  it("someone else's order is a JSON 404 before any stream starts", async () => {
    orderingStub.getOrder.mockRejectedValueOnce(
      // What a failed gRPC call rejects with on the client side: a ServiceError.
      Object.assign(
        new Error('x'),
        rpcError('RESOURCE_NOT_FOUND', { resource: 'ORDER' }).getError() as object,
      ),
    );
    const res = await request(app.getHttpServer())
      .get(`/api/v1/orders/${newId()}/events`)
      .set('Authorization', `Bearer ${token('STAFF')}`);
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).not.toContain('text/event-stream');
    expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('closing the client removes the subscriber', async () => {
    orderingStub.getOrder.mockResolvedValueOnce(openOrder('PAID'));
    const stream = await openStream(app, `/api/v1/orders/${newId()}/events`, token('CUSTOMER'));
    expect(frames.observed).toBe(true);
    stream.close();
    await stream.ended;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(frames.observed).toBe(false);
  });

  it('the staff stream is refused to a customer and never ends on its own; one shared ping timer serves every stream', async () => {
    const refused = await request(app.getHttpServer())
      .get('/api/v1/staff/orders/events')
      .set('Authorization', `Bearer ${token('CUSTOMER')}`);
    expect(refused.status).toBe(403);

    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const first = await openStream(app, '/api/v1/staff/orders/events', token('STAFF'));
    orderingStub.getOrder.mockResolvedValueOnce(openOrder('PAID'));
    const second = await openStream(app, `/api/v1/orders/${newId()}/events`, token('CUSTOMER'));
    expect(vi.getTimerCount()).toBe(1);

    const cancelled = frame(newId(), OrderStatus.CANCELLED);
    frames.next(cancelled);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(first.text()).toContain('"status":"CANCELLED"');

    vi.advanceTimersByTime(25_000);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(first.text()).toContain(': ping\n\n');
    expect(second.text()).toContain(': ping\n\n');

    first.close();
    second.close();
    await Promise.all([first.ended, second.ended]);
  });

  it('shutdown ends every open stream', async () => {
    const second = await createE2eApp([[OrderEventsSource, sourceStub]], { listen: true });
    const other = second.app;
    // Same stub source, separate app: closing it must end its own open stream.
    const stream = await openStream(other, '/api/v1/staff/orders/events', token('STAFF'));
    await other.close();
    await stream.ended;
    expect(stream.status).toBe(200);
  });

  describe('/staff/orders', () => {
    it('every board route is permission-gated', async () => {
      const auth = { Authorization: `Bearer ${token('CUSTOMER')}` };
      expect(
        (await request(app.getHttpServer()).get('/api/v1/staff/orders').set(auth)).status,
      ).toBe(403);
      expect(
        (
          await request(app.getHttpServer())
            .post(`/api/v1/staff/orders/${newId()}/status`)
            .set(auth)
            .send({ to: 'READY' })
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app.getHttpServer())
            .post(`/api/v1/staff/orders/${newId()}/cancel`)
            .set(auth)
            .send({ note: 'x' })
        ).status,
      ).toBe(403);
    });

    it('validates the request shapes', async () => {
      const auth = { Authorization: `Bearer ${token('STAFF')}` };
      const board = await request(app.getHttpServer())
        .get('/api/v1/staff/orders?status=PENDING')
        .set(auth);
      expect(board.status).toBe(400);
      const toCancelled = await request(app.getHttpServer())
        .post(`/api/v1/staff/orders/${newId()}/status`)
        .set(auth)
        .send({ to: 'CANCELLED' });
      expect(toCancelled.status).toBe(400);
      const noNote = await request(app.getHttpServer())
        .post(`/api/v1/staff/orders/${newId()}/cancel`)
        .set(auth)
        .send({});
      expect(noNote.status).toBe(400);
      expect(staffOrdersStub.advanceStatus).not.toHaveBeenCalled();
    });

    it('list and status round trip answer 200', async () => {
      const auth = { Authorization: `Bearer ${token('STAFF')}` };
      staffOrdersStub.listBoard.mockResolvedValueOnce({ orders: [] });
      expect(
        (await request(app.getHttpServer()).get('/api/v1/staff/orders?status=PAID').set(auth))
          .status,
      ).toBe(200);
      expect(staffOrdersStub.listBoard).toHaveBeenCalledWith(
        expect.anything(),
        { status: 'PAID' },
        expect.anything(),
      );
    });
  });
});
