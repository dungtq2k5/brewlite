import { Module } from '@nestjs/common';
import { StripeWebhookController } from './stripe-webhook.controller.js';
import { WebhookServiceGrpcClient } from './webhook-service-grpc.client.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { PaymentServiceGrpcClient } from './payment-service-grpc.client.js';

@Module({
  controllers: [PaymentsController, StripeWebhookController],
  providers: [PaymentsService, PaymentServiceGrpcClient, WebhookServiceGrpcClient],
})
export class PaymentsModule {}
