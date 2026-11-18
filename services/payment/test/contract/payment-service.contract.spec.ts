import type { INestMicroservice } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Transport, type MicroserviceOptions } from '@nestjs/microservices';
import { Metadata, status, type ServiceError } from '@grpc/grpc-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { newId, Role } from '@brewlite/contracts';
import { PAYMENT_PROTO_FILES, PROTO_ROOT } from '@brewlite/contracts/proto-paths.js';
import {
  BaseGrpcClient,
  PROTO_LOADER_OPTIONS,
  readErrorCode,
  readErrorDetails,
  type Caller,
} from '@brewlite/nest-common';
import type {
  CreatePaymentRequest,
  CreatePaymentResponse,
  FakeConfirmRequest,
  FakeConfirmResponse,
  GetPaymentRequest,
  GetPaymentResponse,
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
  createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    return this.call('createPayment', request, { caller });
  }
  getPayment(request: GetPaymentRequest): Promise<GetPaymentResponse> {
    return this.call('getPayment', request, { caller });
  }
  fakeConfirm(request: FakeConfirmRequest): Promise<FakeConfirmResponse> {
    return this.call('fakeConfirm', request, { caller });
  }
}

/** What ordering's `BeginPayment` rejects with on payment's side of the first hop. */
function orderingRefusal(code: string, details: unknown): ServiceError {
  const metadata = new Metadata();
  metadata.set('bl-error-code', code);
  metadata.set('bl-error-details-bin', Buffer.from(JSON.stringify(details)));
  return Object.assign(new Error(code), {
    code: status.FAILED_PRECONDITION,
    details: code,
    metadata,
  });
}

const beginPayment = vi.fn();

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
      .useValue({ beginPayment })
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

  it("relays ordering's BeginPayment refusal across the SECOND hop, code and details unchanged, no row", async () => {
    const orderId = newId();
    beginPayment.mockRejectedValueOnce(orderingRefusal('INVALID_STATE', { status: 'CANCELLED' }));

    const error = (await client
      .createPayment({ orderId, idempotencyKey: newId() })
      .catch((e: unknown) => e)) as ServiceError;

    expect(error.code).toBe(status.FAILED_PRECONDITION);
    expect(readErrorCode(error)).toBe('INVALID_STATE');
    expect(readErrorDetails(error)).toEqual({ status: 'CANCELLED' });
    expect(await prisma.payment.count({ where: { orderId } })).toBe(0);
  });

  it('completes GetPayment and FakeConfirm round trips under the caller from metadata', async () => {
    const payment = await prisma.payment.create({
      data: {
        id: newId(),
        orderId: newId(),
        userId: caller.kind === 'USER' ? caller.userId : '',
        amountVnd: 50_000,
        provider: 'FAKE',
        status: 'PENDING',
        idempotencyKey: newId(),
        requestHash: 'x'.repeat(64),
      },
    });

    expect((await client.getPayment({ id: payment.id })).payment).toMatchObject({
      id: payment.id,
      status: 'PENDING',
      provider: 'FAKE',
      amountVnd: '50000',
    });
    expect(
      (await client.fakeConfirm({ id: payment.id, outcome: 'SUCCEEDED' })).payment,
    ).toMatchObject({ id: payment.id, status: 'SUCCEEDED', method: 'FAKE' });
  });

  it("answers NOT_FOUND / RESOURCE_NOT_FOUND for another user's payment", async () => {
    const theirs = await prisma.payment.create({
      data: {
        id: newId(),
        orderId: newId(),
        userId: newId(),
        amountVnd: 50_000,
        provider: 'FAKE',
        status: 'PENDING',
        idempotencyKey: newId(),
        requestHash: 'x'.repeat(64),
      },
    });
    const error = (await client
      .getPayment({ id: theirs.id })
      .catch((e: unknown) => e)) as ServiceError;
    expect(error.code).toBe(status.NOT_FOUND);
    expect(readErrorCode(error)).toBe('RESOURCE_NOT_FOUND');
    expect(readErrorDetails(error)).toEqual({ resource: 'PAYMENT' });
  });
});
