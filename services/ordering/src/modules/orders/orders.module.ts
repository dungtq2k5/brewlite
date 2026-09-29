import { Module } from '@nestjs/common';
import { OutboxService } from '@brewlite/nest-common';
import { CatalogMenuGrpcClient } from './catalog-menu-grpc.client.js';
import { CatalogStockGrpcClient } from './catalog-stock-grpc.client.js';
import { OrderGrpcController } from './order-grpc.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  controllers: [OrderGrpcController],
  providers: [OrdersService, OutboxService, CatalogMenuGrpcClient, CatalogStockGrpcClient],
  exports: [OrdersService],
})
export class OrdersModule {}
