import { Controller, UseInterceptors } from '@nestjs/common';
import type { Metadata } from '@grpc/grpc-js';
import { zUuidV7 } from '@brewlite/contracts';
import {
  callerFrom,
  GrpcRequestContextInterceptor,
  requireUser,
  rpcError,
} from '@brewlite/nest-common';
import {
  LoyaltyServiceControllerMethods,
  type GetLoyaltyForUserRequest,
  type GetLoyaltyForUserResponse,
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

  getLoyaltyForUser(request: GetLoyaltyForUserRequest): Promise<GetLoyaltyForUserResponse> {
    if (!zUuidV7.safeParse(request.userId).success) {
      throw rpcError('VALIDATION_FAILED', {
        issues: [{ path: '/userId', code: 'invalid_format' }],
      });
    }
    return this.loyalty.getLoyaltyForUser(request.userId);
  }
}
