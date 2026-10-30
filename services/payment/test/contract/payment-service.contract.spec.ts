import type { INestMicroservice } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Transport, type MicroserviceOptions } from '@nestjs/microservices';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { newId, Role } from '@brewlite/contracts';
import { PAYMENT_PROTO_FILES, PROTO_ROOT } from '@brewlite/contracts/proto-paths.js';
import { BaseGrpcClient, PROTO_LOADER_OPTIONS, type Caller } from '@brewlite/nest-common';
import type {
  ListPaymentsForOrderRequest,
  ListPaymentsForOrderResponse,
} from '@brewlite/contracts/generated/brewlite/payment/payment_service.js';
import { envSchema } from '../../src/config/env.schema.js';
import { OrderingGrpcClient } from '../../src/modules/payments/ordering-grpc.client.js';
import { PaymentsModule } from '../../src/modules/payments/payments.module.js';
import { PrismaModule } from '../../src/modules/prisma/prisma.module.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { testEnv } from '../setup/env.js';

const caller: Caller = { kind: 'USER', userId: newId(), role: Role.ADMIN };

class TestPaymentClient extends BaseGrpcClient {
  constructor(url: string) {
    super({
      serviceName: 'brewlite.payment.PaymentService',
      protoFiles: PAYMENT_PROTO_FILES,
      includeDirs: [PROTO_ROOT],
      url,
    });
  }
  listPaymentsForOrder(
    request: ListPaymentsForOrderRequest,
  ): Promise<ListPaymentsForOrderResponse> {
    return this.call('listPaymentsForOrder', request, { caller });
  }
}

describe('PaymentService gRPC contract', () => {
  const url = 'localhost:25092';
  let microservice: INestMicroservice;
  let client: TestPaymentClient;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          validate: () =>
            envSchema.parse({
              ...testEnv,
              DATABASE_URL: testEnv.DATABASE_URL_TEST,
              NODE_ENV: 'development',
            }),
        }),
        PrismaModule,
        PaymentsModule,
      ],
    })
      .overrideProvider(OrderingGrpcClient)
      .useValue({ beginPayment: vi.fn() })
      .compile();
    microservice = moduleRef.createNestMicroservice<MicroserviceOptions>({
      transport: Transport.GRPC,
      options: {
        package: 'brewlite.payment',
        protoPath: PAYMENT_PROTO_FILES,
        url,
        loader: { ...PROTO_LOADER_OPTIONS, includeDirs: [PROTO_ROOT] },
      },
    });
    await microservice.listen();
    prisma = moduleRef.get(PrismaService);
    client = new TestPaymentClient(url);
  });

  afterAll(async () => {
    await microservice.close();
  });

  it('completes a real ListPaymentsForOrder round trip: newest first, no client secret, int64 as a string', async () => {
    const orderId = newId();
    const row = (overrides: Record<string, unknown>) => ({
      id: newId(),
      orderId,
      userId: newId(),
      amountVnd: 50_000,
      provider: 'STRIPE',
      idempotencyKey: newId(),
      requestHash: 'x'.repeat(64),
      ...overrides,
    });
    const failed = await prisma.payment.create({ data: row({ status: 'FAILED' }) });
    const pending = await prisma.payment.create({
      data: row({ status: 'PENDING', stripeCheckoutSessionId: `cs_test_${newId()}` }),
    });

    const res = await client.listPaymentsForOrder({ orderId });
    expect(res.payments.map((p) => p.id)).toEqual([pending.id, failed.id]);
    expect(res.payments[0]).toMatchObject({ status: 'PENDING', amountVnd: '50000' });
    expect(res.payments[0]!.clientSecret).toBeUndefined();
  });

  it('answers an empty list for an order with no payment', async () => {
    expect(await client.listPaymentsForOrder({ orderId: newId() })).toEqual({ payments: [] });
  });
});
