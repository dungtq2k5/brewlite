import { Module } from '@nestjs/common';
import { StaffOrdersController } from './staff-orders.controller.js';
import { StaffOrdersService } from './staff-orders.service.js';
import { StaffOrdersGrpcClient } from './staff-orders-grpc.client.js';

@Module({
  controllers: [StaffOrdersController],
  providers: [StaffOrdersService, StaffOrdersGrpcClient],
})
export class StaffOrdersModule {}
