import { Module } from '@nestjs/common';
import { MenuModule } from '../menu/menu.module.js';
import { StockGrpcController } from './stock-grpc.controller.js';
import { StockService } from './stock.service.js';
import { OrderStatusConsumer } from './order-status.consumer.js';
import { OrderingOrderGrpcClient } from './ordering-order-grpc.client.js';

@Module({
  imports: [MenuModule],
  controllers: [StockGrpcController],
  providers: [StockService, OrderStatusConsumer, OrderingOrderGrpcClient],
  exports: [StockService, OrderStatusConsumer, OrderingOrderGrpcClient],
})
export class StockModule {}
