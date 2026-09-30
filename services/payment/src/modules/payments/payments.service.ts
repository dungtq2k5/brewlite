import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { contentHash, requireUser, rpcError, type Caller } from '@brewlite/nest-common';
import {
  newId,
  PaymentFailureReason,
  PaymentMethod,
  PaymentProvider as ProviderKind,
  PaymentStatus,
} from '@brewlite/contracts';
import type {
  CreatePaymentRequest,
  CreatePaymentResponse,
  FakeConfirmRequest,
  FakeConfirmResponse,
  GetPaymentRequest,
  GetPaymentResponse,
} from '@brewlite/contracts/generated/brewlite/payment/payment_service.js';
import type { Env } from '../../config/env.schema.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrderingGrpcClient } from './ordering-grpc.client.js';
import { rethrowOrderingError } from './domain/ordering-errors.js';
import { PaymentOutcomeService } from './payment-outcome.service.js';
import { toProtoPayment } from './payment.mapper.js';
import {
  PAYMENT_PROVIDER_TOKEN,
  type PaymentProvider,
} from '../../providers/payment/payment-provider.interface.js';

const TRANSACTION_TIMEOUT_MS = 10_000;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly ordering: OrderingGrpcClient,
    private readonly outcome: PaymentOutcomeService,
    @Inject(PAYMENT_PROVIDER_TOKEN) private readonly provider: PaymentProvider,
  ) {}

  /**
   * The advisory lock is the first statement in the transaction — it serialises every
   * `CreatePayment` for one order, so two tabs racing with different idempotency keys
   * never both call `BeginPayment` (api §6.2).
   */
  async createPayment(
    request: CreatePaymentRequest,
    caller: Caller,
  ): Promise<CreatePaymentResponse> {
    const { userId } = requireUser(caller);
    const { orderId, idempotencyKey } = request;
    const requestHash = contentHash({ orderId });

    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${orderId}, 0))`;

        const existing = await tx.payment.findUnique({
          where: { userId_idempotencyKey: { userId, idempotencyKey } },
        });
        if (existing) {
          if (existing.requestHash !== requestHash) throw rpcError('IDEMPOTENCY_KEY_REUSED');
          return { payment: toProtoPayment(existing), created: false };
        }

        const pending = await tx.payment.findFirst({
          where: { orderId, userId, status: PaymentStatus.PENDING },
        });
        if (pending) return { payment: toProtoPayment(pending), created: false };

        const paymentId = newId();
        let begin;
        try {
          begin = await this.ordering.beginPayment({ orderId, userId, paymentId });
        } catch (error) {
          rethrowOrderingError(error);
        }
        const amountVnd = Number(begin.totalVnd);

        const checkout = await this.provider.startCheckout({
          paymentId,
          orderId,
          orderNo: begin.orderNo,
          amountVnd,
          idempotencyKey,
        });

        const created = await tx.payment.create({
          data: {
            id: paymentId,
            orderId,
            userId,
            amountVnd,
            provider: this.provider.kind,
            status: PaymentStatus.PENDING,
            idempotencyKey,
            requestHash,
            stripeCheckoutSessionId: checkout.sessionId,
            expiresAt: checkout.expiresAt,
          },
        });

        return { payment: toProtoPayment(created), created: true };
      },
      { timeout: TRANSACTION_TIMEOUT_MS },
    );
  }

  async getPayment(request: GetPaymentRequest, caller: Caller): Promise<GetPaymentResponse> {
    const { userId } = requireUser(caller);
    const payment = await this.prisma.payment.findFirst({ where: { id: request.id, userId } });
    if (!payment) throw rpcError('RESOURCE_NOT_FOUND', { resource: 'PAYMENT' });
    return { payment: toProtoPayment(payment) };
  }

  /** Answers 404, as if the route did not exist, whenever it would let anyone mark an order paid for real (api §4). */
  async fakeConfirm(request: FakeConfirmRequest, caller: Caller): Promise<FakeConfirmResponse> {
    const { userId } = requireUser(caller);
    if (this.config.get('NODE_ENV', { infer: true }) === 'production') {
      throw rpcError('ROUTE_NOT_FOUND');
    }

    const payment = await this.prisma.payment.findFirst({ where: { id: request.id, userId } });
    if (!payment) throw rpcError('RESOURCE_NOT_FOUND', { resource: 'PAYMENT' });
    if (payment.provider !== ProviderKind.FAKE) throw rpcError('ROUTE_NOT_FOUND');

    const outcome =
      request.outcome === 'SUCCEEDED'
        ? ({ kind: 'SUCCEEDED', method: PaymentMethod.FAKE } as const)
        : ({ kind: 'FAILED', reason: PaymentFailureReason.SIMULATED } as const);

    const updated = await this.prisma.$transaction((tx) =>
      this.outcome.apply(tx, payment.id, outcome),
    );
    return { payment: toProtoPayment(updated) };
  }
}
