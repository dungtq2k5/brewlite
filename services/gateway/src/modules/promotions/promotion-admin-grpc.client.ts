import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseGrpcClient, type Caller } from '@brewlite/nest-common';
import { ORDERING_PROTO_FILES, PROTO_ROOT } from '@brewlite/contracts/proto-paths.js';
import type {
  CreatePromotionRequest,
  CreatePromotionResponse,
  DeletePromotionRequest,
  DeletePromotionResponse,
  GetPromotionRequest,
  GetPromotionResponse,
  ListPromotionsRequest,
  ListPromotionsResponse,
  RestorePromotionRequest,
  RestorePromotionResponse,
  UpdatePromotionRequest,
  UpdatePromotionResponse,
} from '@brewlite/contracts/generated/brewlite/ordering/promotion_service.js';
import type { Env } from '../../config/env.schema.js';

@Injectable()
export class PromotionAdminGrpcClient extends BaseGrpcClient {
  constructor(config: ConfigService<Env, true>) {
    super({
      serviceName: 'brewlite.ordering.PromotionAdminService',
      protoFiles: ORDERING_PROTO_FILES,
      includeDirs: [PROTO_ROOT],
      url: config.get('ORDERING_GRPC_URL', { infer: true }),
    });
  }

  listPromotions(
    request: ListPromotionsRequest,
    requestId?: string,
  ): Promise<ListPromotionsResponse> {
    return this.call('listPromotions', request, { requestId });
  }

  createPromotion(
    request: CreatePromotionRequest,
    requestId?: string,
  ): Promise<CreatePromotionResponse> {
    return this.call('createPromotion', request, { requestId });
  }

  getPromotion(request: GetPromotionRequest, requestId?: string): Promise<GetPromotionResponse> {
    return this.call('getPromotion', request, { requestId });
  }

  updatePromotion(
    request: UpdatePromotionRequest,
    requestId?: string,
  ): Promise<UpdatePromotionResponse> {
    return this.call('updatePromotion', request, { requestId });
  }

  deletePromotion(
    caller: Caller,
    request: DeletePromotionRequest,
    requestId?: string,
  ): Promise<DeletePromotionResponse> {
    return this.call('deletePromotion', request, { requestId, caller });
  }

  restorePromotion(
    request: RestorePromotionRequest,
    requestId?: string,
  ): Promise<RestorePromotionResponse> {
    return this.call('restorePromotion', request, { requestId });
  }
}
