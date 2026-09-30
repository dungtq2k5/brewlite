import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { PaymentServiceGrpcClient } from './payment-service-grpc.client.js';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentServiceGrpcClient],
})
export class PaymentsModule {}
