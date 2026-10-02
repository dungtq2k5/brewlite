import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { OrderingServiceGrpcClient } from './ordering-service-grpc.client.js';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrderingServiceGrpcClient],
})
export class OrdersModule {}
