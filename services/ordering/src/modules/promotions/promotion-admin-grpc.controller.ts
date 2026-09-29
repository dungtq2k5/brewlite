import { Controller, UseInterceptors } from '@nestjs/common';
import type { Metadata } from '@grpc/grpc-js';
import { callerFrom, GrpcRequestContextInterceptor } from '@brewlite/nest-common';
import {
  PromotionAdminServiceControllerMethods,
  type CreatePromotionRequest,
  type CreatePromotionResponse,
  type DeletePromotionRequest,
  type DeletePromotionResponse,
  type GetPromotionRequest,
  type GetPromotionResponse,
  type ListPromotionsRequest,
  type ListPromotionsResponse,
  type PromotionAdminServiceController,
  type RestorePromotionRequest,
  type RestorePromotionResponse,
  type UpdatePromotionRequest,
  type UpdatePromotionResponse,
} from '@brewlite/contracts/generated/brewlite/ordering/promotion_service.js';
import { PromotionAdminService } from './promotion-admin.service.js';

@Controller()
@PromotionAdminServiceControllerMethods()
@UseInterceptors(GrpcRequestContextInterceptor)
export class PromotionAdminGrpcController implements PromotionAdminServiceController {
  constructor(private readonly promotions: PromotionAdminService) {}

  listPromotions(request: ListPromotionsRequest): Promise<ListPromotionsResponse> {
    return this.promotions.listPromotions(request);
  }

  createPromotion(request: CreatePromotionRequest): Promise<CreatePromotionResponse> {
    return this.promotions.createPromotion(request);
  }

  getPromotion(request: GetPromotionRequest): Promise<GetPromotionResponse> {
    return this.promotions.getPromotion(request);
  }

  updatePromotion(request: UpdatePromotionRequest): Promise<UpdatePromotionResponse> {
    return this.promotions.updatePromotion(request);
  }

  deletePromotion(
    request: DeletePromotionRequest,
    metadata?: Metadata,
  ): Promise<DeletePromotionResponse> {
    return this.promotions.deletePromotion(request, callerFrom(metadata));
  }

  restorePromotion(request: RestorePromotionRequest): Promise<RestorePromotionResponse> {
    return this.promotions.restorePromotion(request);
  }
}
