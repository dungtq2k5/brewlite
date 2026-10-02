import { Module } from '@nestjs/common';
import { PromotionAdminGrpcController } from './promotion-admin-grpc.controller.js';
import { PromotionAdminService } from './promotion-admin.service.js';
import { PromotionEvaluationService } from './promotion-evaluation.service.js';

@Module({
  controllers: [PromotionAdminGrpcController],
  providers: [PromotionAdminService, PromotionEvaluationService],
  exports: [PromotionAdminService, PromotionEvaluationService],
})
export class PromotionsModule {}
