import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OutboxService } from '@brewlite/nest-common';
import { PrismaModule } from '../prisma/prisma.module.js';
import type { Env } from '../../config/env.schema.js';
import { PaymentsGrpcController } from './payments-grpc.controller.js';
import { OrderCancelledConsumer } from './order-cancelled.consumer.js';
import { PaymentRejectedConsumer } from './payment-rejected.consumer.js';
import { RefundService } from './refund.service.js';
import { WebhookGrpcController } from './webhook-grpc.controller.js';
import { WebhookService } from './webhook.service.js';
import { PaymentsService } from './payments.service.js';
import { PaymentOutcomeService } from './payment-outcome.service.js';
import { OrderingGrpcClient } from './ordering-grpc.client.js';
import {
  createStripeClient,
  StripePaymentProvider,
} from '../../providers/payment/stripe.payment-provider.js';
import { FakePaymentProvider } from '../../providers/payment/fake.payment-provider.js';
import {
  PAYMENT_PROVIDER_TOKEN,
  type PaymentProvider,
} from '../../providers/payment/payment-provider.interface.js';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [PaymentsGrpcController, WebhookGrpcController],
  providers: [
    PaymentsService,
    PaymentOutcomeService,
    RefundService,
    WebhookService,
    OrderCancelledConsumer,
    PaymentRejectedConsumer,
    OutboxService,
    OrderingGrpcClient,
    FakePaymentProvider,
    {
      provide: PAYMENT_PROVIDER_TOKEN,
      inject: [ConfigService, FakePaymentProvider],
      useFactory: (
        config: ConfigService<Env, true>,
        fake: FakePaymentProvider,
      ): PaymentProvider => {
        if (config.get('PAYMENT_PROVIDER', { infer: true }) === 'fake') return fake;
        // The env schema guarantees these three when the provider is `stripe`.
        return new StripePaymentProvider(
          createStripeClient(config.get('STRIPE_SECRET_KEY', { infer: true })!),
          config.get('WEB_URL', { infer: true })!,
          config.get('STRIPE_WEBHOOK_SECRET', { infer: true })!,
        );
      },
    },
  ],
  exports: [OrderCancelledConsumer, PaymentRejectedConsumer],
})
export class PaymentsModule {}
