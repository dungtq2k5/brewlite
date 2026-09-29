import { Module } from '@nestjs/common';
import { OutboxService } from '@brewlite/nest-common';
import { PromotionsModule } from '../promotions/promotions.module.js';
import { LoyaltyModule } from '../loyalty/loyalty.module.js';
import { CatalogMenuGrpcClient } from './catalog-menu-grpc.client.js';
import { CatalogStockGrpcClient } from './catalog-stock-grpc.client.js';
import { OrderGrpcController } from './order-grpc.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [PromotionsModule, LoyaltyModule],
  controllers: [OrderGrpcController],
  providers: [OrdersService, OutboxService, CatalogMenuGrpcClient, CatalogStockGrpcClient],
  exports: [OrdersService],
})
export class OrdersModule {}
