import { Module } from '@nestjs/common';
import { PaymentServiceGrpcClient } from '../payments/payment-service-grpc.client.js';
import { AdminOrderGrpcClient } from './admin-order-grpc.client.js';
import { AdminOrdersController } from './admin-orders.controller.js';
import { AdminOrdersService } from './admin-orders.service.js';

@Module({
  controllers: [AdminOrdersController],
  providers: [AdminOrdersService, AdminOrderGrpcClient, PaymentServiceGrpcClient],
})
export class AdminOrdersModule {}
