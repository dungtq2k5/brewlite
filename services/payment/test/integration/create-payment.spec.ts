import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Metadata } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { newId, Role } from '@brewlite/contracts';
import type { Caller } from '@brewlite/nest-common';
import { envSchema } from '../../src/config/env.schema.js';
import { PaymentsModule } from '../../src/modules/payments/payments.module.js';
import { PaymentsService } from '../../src/modules/payments/payments.service.js';
import { OrderingGrpcClient } from '../../src/modules/payments/ordering-grpc.client.js';
import { PrismaModule } from '../../src/modules/prisma/prisma.module.js';
import { prisma } from '../setup/per-file.js';
import { testEnv } from '../setup/env.js';

function buildOrderingStub() {
  return {
    beginPayment: vi.fn().mockResolvedValue({ orderNo: '1000', totalVnd: '50000' }),
  };
}

async function buildModule(ordering: unknown) {
  const configModule = ConfigModule.forRoot({
    isGlobal: true,
    validate: () =>
      envSchema.parse({
        ...testEnv,
        DATABASE_URL: testEnv.DATABASE_URL_TEST,
      }),
  });
  const moduleRef = await Test.createTestingModule({
    imports: [configModule, PrismaModule, PaymentsModule],
  })
    .overrideProvider(OrderingGrpcClient)
    .useValue(ordering)
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

function buildRequest(orderId: string, overrides: { idempotencyKey?: string } = {}) {
  return { orderId, idempotencyKey: overrides.idempotencyKey ?? newId() };
}

describe('PaymentsService.createPayment — real DB, ordering stubbed', () => {
  let app: Awaited<ReturnType<typeof buildModule>>;
  let payments: PaymentsService;
  let ordering: ReturnType<typeof buildOrderingStub>;
  const caller: Caller = { kind: 'USER', userId: newId(), role: Role.CUSTOMER };

  beforeAll(async () => {
    ordering = buildOrderingStub();
    app = await buildModule(ordering);
    payments = app.get(PaymentsService);
  });

  afterEach(() => {
    ordering.beginPayment.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('proof: creates ONE payment for two requests with the same Idempotency-Key', () => {
    it('sequential — the second call returns the same payment, created: false', async () => {
      const request = buildRequest(newId());
      const first = await payments.createPayment(request, caller);
      expect(first.created).toBe(true);

      const second = await payments.createPayment(request, caller);
      expect(second.created).toBe(false);
      expect(second.payment?.id).toBe(first.payment?.id);

      const count = await prisma.payment.count({ where: { id: first.payment!.id } });
      expect(count).toBe(1);
      expect(ordering.beginPayment).toHaveBeenCalledTimes(1);
    });

    it('5 concurrent — one row, every response the same id, the winner named last', async () => {
      const request = buildRequest(newId());

      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () => payments.createPayment(request, caller)),
      );
      const fulfilled = results
        .filter(
          (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof payments.createPayment>>> =>
            r.status === 'fulfilled',
        )
        .map((r) => r.value);
      expect(fulfilled.length).toBe(5);
      const ids = new Set(fulfilled.map((r) => r.payment?.id));
      expect(ids.size).toBe(1);
      expect(fulfilled.filter((r) => r.created).length).toBe(1);

      const [paymentId] = ids;
      const count = await prisma.payment.count({ where: { id: paymentId } });
      expect(count).toBe(1);
    });

    it('the same key with a different order refuses IDEMPOTENCY_KEY_REUSED', async () => {
      const idempotencyKey = newId();
      await payments.createPayment(buildRequest(newId(), { idempotencyKey }), caller);

      const error = await payments
        .createPayment(buildRequest(newId(), { idempotencyKey }), caller)
        .catch((e: unknown) => e);
      expect(errorCodeOf(error)).toBe('IDEMPOTENCY_KEY_REUSED');
    });
  });

  it('two different keys for one order, concurrently — one PENDING row, both responses its id', async () => {
    const orderId = newId();

    const results = await Promise.allSettled([
      payments.createPayment(buildRequest(orderId), caller),
      payments.createPayment(buildRequest(orderId), caller),
    ]);
    const fulfilled = results
      .filter(
        (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof payments.createPayment>>> =>
          r.status === 'fulfilled',
      )
      .map((r) => r.value);
    expect(fulfilled.length).toBe(2);
    const ids = new Set(fulfilled.map((r) => r.payment?.id));
    expect(ids.size).toBe(1);

    const rows = await prisma.payment.findMany({ where: { orderId } });
    expect(rows.length).toBe(1);
    expect([...ids][0]).toBe(rows[0].id);

    // The lock serialises the two calls — the second finds the first's PENDING row at
    // step 2 and never reaches BeginPayment a second time.
    expect(ordering.beginPayment).toHaveBeenCalledTimes(1);
    const [call] = ordering.beginPayment.mock.calls[0] as [{ paymentId: string }];
    expect(call.paymentId).toBe(rows[0].id);
  });

  it('a failing BeginPayment writes no row', async () => {
    ordering.beginPayment.mockRejectedValueOnce(new Error('boom'));
    const orderId = newId();

    await expect(payments.createPayment(buildRequest(orderId), caller)).rejects.toThrow();

    const count = await prisma.payment.count({ where: { orderId } });
    expect(count).toBe(0);
  });
});
