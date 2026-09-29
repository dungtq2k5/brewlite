import { Module } from '@nestjs/common';
import { PromotionAdminGrpcClient } from './promotion-admin-grpc.client.js';
import { PromotionsController } from './promotions.controller.js';
import { PromotionsService } from './promotions.service.js';

@Module({
  controllers: [PromotionsController],
  providers: [PromotionAdminGrpcClient, PromotionsService],
})
export class PromotionsModule {}
