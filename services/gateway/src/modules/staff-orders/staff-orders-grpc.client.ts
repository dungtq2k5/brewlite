import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseGrpcClient, type Caller } from '@brewlite/nest-common';
import { ORDERING_PROTO_FILES, PROTO_ROOT } from '@brewlite/contracts/proto-paths.js';
import type {
  AdvanceStatusRequest,
  AdvanceStatusResponse,
  CancelPaidRequest,
  CancelPaidResponse,
  ListBoardRequest,
  ListBoardResponse,
} from '@brewlite/contracts/generated/brewlite/ordering/staff_order_service.js';
import type { Env } from '../../config/env.schema.js';

@Injectable()
export class StaffOrdersGrpcClient extends BaseGrpcClient {
  constructor(config: ConfigService<Env, true>) {
    super({
      serviceName: 'brewlite.ordering.StaffOrderService',
      protoFiles: ORDERING_PROTO_FILES,
      includeDirs: [PROTO_ROOT],
      url: config.get('ORDERING_GRPC_URL', { infer: true }),
    });
  }

  listBoard(
    caller: Caller,
    request: ListBoardRequest,
    requestId?: string,
  ): Promise<ListBoardResponse> {
    return this.call('listBoard', request, { requestId, caller });
  }

  advanceStatus(
    caller: Caller,
    request: AdvanceStatusRequest,
    requestId?: string,
  ): Promise<AdvanceStatusResponse> {
    return this.call('advanceStatus', request, { requestId, caller });
  }

  cancelPaid(
    caller: Caller,
    request: CancelPaidRequest,
    requestId?: string,
  ): Promise<CancelPaidResponse> {
    return this.call('cancelPaid', request, { requestId, caller });
  }
}
