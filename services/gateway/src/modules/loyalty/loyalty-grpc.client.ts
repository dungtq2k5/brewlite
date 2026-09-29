import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseGrpcClient, type Caller } from '@brewlite/nest-common';
import { ORDERING_PROTO_FILES, PROTO_ROOT } from '@brewlite/contracts/proto-paths.js';
import type {
  GetMyLoyaltyRequest,
  GetMyLoyaltyResponse,
} from '@brewlite/contracts/generated/brewlite/ordering/promotion_service.js';
import type { Env } from '../../config/env.schema.js';

@Injectable()
export class LoyaltyGrpcClient extends BaseGrpcClient {
  constructor(config: ConfigService<Env, true>) {
    super({
      serviceName: 'brewlite.ordering.LoyaltyService',
      protoFiles: ORDERING_PROTO_FILES,
      includeDirs: [PROTO_ROOT],
      url: config.get('ORDERING_GRPC_URL', { infer: true }),
    });
  }

  getMyLoyalty(
    caller: Caller,
    request: GetMyLoyaltyRequest,
    requestId?: string,
  ): Promise<GetMyLoyaltyResponse> {
    return this.call('getMyLoyalty', request, { requestId, caller });
  }
}
