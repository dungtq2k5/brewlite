import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module.js';
import { StaffOrderGrpcController } from './staff-order-grpc.controller.js';
import { StaffOrdersService } from './staff-orders.service.js';

@Module({
  imports: [OrdersModule],
  controllers: [StaffOrderGrpcController],
  providers: [StaffOrdersService],
})
export class StaffOrdersModule {}
