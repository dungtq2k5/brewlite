import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OutboxService } from '@brewlite/nest-common';
import { PrismaModule } from '../prisma/prisma.module.js';
import type { Env } from '../../config/env.schema.js';
import { PaymentsGrpcController } from './payments-grpc.controller.js';
import { PaymentsService } from './payments.service.js';
import { PaymentOutcomeService } from './payment-outcome.service.js';
import { OrderingGrpcClient } from './ordering-grpc.client.js';
import { FakePaymentProvider } from '../../providers/payment/fake.payment-provider.js';
import {
  PAYMENT_PROVIDER_TOKEN,
  type PaymentProvider,
} from '../../providers/payment/payment-provider.interface.js';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [PaymentsGrpcController],
  providers: [
    PaymentsService,
    PaymentOutcomeService,
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
        const provider = config.get('PAYMENT_PROVIDER', { infer: true });
        if (provider === 'fake') return fake;
        // StripePaymentProvider lands in 08 — nothing else implements the interface yet.
        throw new Error(`PAYMENT_PROVIDER=${provider} has no implementation yet`);
      },
    },
  ],
})
export class PaymentsModule {}
