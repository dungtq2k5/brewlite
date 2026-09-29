import { Controller, UseInterceptors } from '@nestjs/common';
import type { Metadata } from '@grpc/grpc-js';
import { callerFrom, GrpcRequestContextInterceptor, requireUser } from '@brewlite/nest-common';
import {
  LoyaltyServiceControllerMethods,
  type GetMyLoyaltyRequest,
  type GetMyLoyaltyResponse,
  type LoyaltyServiceController,
} from '@brewlite/contracts/generated/brewlite/ordering/promotion_service.js';
import { LoyaltyService } from './loyalty.service.js';

@Controller()
@LoyaltyServiceControllerMethods()
@UseInterceptors(GrpcRequestContextInterceptor)
export class LoyaltyGrpcController implements LoyaltyServiceController {
  constructor(private readonly loyalty: LoyaltyService) {}

  getMyLoyalty(_request: GetMyLoyaltyRequest, metadata?: Metadata): Promise<GetMyLoyaltyResponse> {
    const { userId } = requireUser(callerFrom(metadata));
    return this.loyalty.getMyLoyalty(userId);
  }
}
