import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module.js';
import { AdminOrderGrpcController } from './admin-order-grpc.controller.js';
import { AdminOrdersService } from './admin-orders.service.js';

@Module({
  imports: [OrdersModule],
  controllers: [AdminOrderGrpcController],
  providers: [AdminOrdersService],
})
export class AdminOrdersModule {}
