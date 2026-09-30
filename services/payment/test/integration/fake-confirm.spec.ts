import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Metadata } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { EVENT_SCHEMAS, newId, Role } from '@brewlite/contracts';
import type { Caller } from '@brewlite/nest-common';
import { envSchema } from '../../src/config/env.schema.js';
import { PaymentsModule } from '../../src/modules/payments/payments.module.js';
import { PaymentsService } from '../../src/modules/payments/payments.service.js';
import { OrderingGrpcClient } from '../../src/modules/payments/ordering-grpc.client.js';
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
        NODE_ENV: 'development',
      }),
  });
  const moduleRef = await Test.createTestingModule({
    imports: [configModule, PrismaModule, PaymentsModule],
  })
    .overrideProvider(OrderingGrpcClient)
    .useValue({ beginPayment: vi.fn() })
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

const caller: Caller = { kind: 'USER', userId: newId(), role: Role.CUSTOMER };

describe('PaymentsService.fakeConfirm', () => {
  describe('in development', () => {
    let app: Awaited<ReturnType<typeof buildModule>>;
    let payments: PaymentsService;

    beforeAll(async () => {
      app = await buildModule();
      payments = app.get(PaymentsService);
    });

    afterAll(async () => {
      await app.close();
    });

    it('applies SUCCEEDED and writes an outbox row validating against its own schema', async () => {
      const paymentId = newId();
      await prisma.payment.create({
        data: {
          id: paymentId,
          orderId: newId(),
          userId: caller.kind === 'USER' ? caller.userId : '',
          amountVnd: 50_000,
          provider: 'FAKE',
          status: 'PENDING',
          idempotencyKey: newId(),
          requestHash: 'x'.repeat(64),
        },
      });

      const result = await payments.fakeConfirm({ id: paymentId, outcome: 'SUCCEEDED' }, caller);
      expect(result.payment?.status).toBe('SUCCEEDED');
      expect(result.payment?.method).toBe('FAKE');

      const row = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: paymentId } });
      expect(() => EVENT_SCHEMAS['payment.payment.succeeded'].parse(row.payload)).not.toThrow();
    });

    it('a second confirm refuses INVALID_STATE', async () => {
      const paymentId = newId();
      await prisma.payment.create({
        data: {
          id: paymentId,
          orderId: newId(),
          userId: caller.kind === 'USER' ? caller.userId : '',
          amountVnd: 50_000,
          provider: 'FAKE',
          status: 'PENDING',
          idempotencyKey: newId(),
          requestHash: 'x'.repeat(64),
        },
      });

      await payments.fakeConfirm({ id: paymentId, outcome: 'SUCCEEDED' }, caller);
      const error = await payments
        .fakeConfirm({ id: paymentId, outcome: 'SUCCEEDED' }, caller)
        .catch((e: unknown) => e);
      expect(errorCodeOf(error)).toBe('INVALID_STATE');
    });
  });
});
