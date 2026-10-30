import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseGrpcClient, type Caller } from '@brewlite/nest-common';
import { ORDERING_PROTO_FILES, PROTO_ROOT } from '@brewlite/contracts/proto-paths.js';
import type {
  GetAdminOrderRequest,
  GetAdminOrderResponse,
  ListOrdersRequest,
  ListOrdersResponse,
} from '@brewlite/contracts/generated/brewlite/ordering/admin_order_service.js';
import type { Env } from '../../config/env.schema.js';

@Injectable()
export class AdminOrderGrpcClient extends BaseGrpcClient {
  constructor(config: ConfigService<Env, true>) {
    super({
      serviceName: 'brewlite.ordering.AdminOrderService',
      protoFiles: ORDERING_PROTO_FILES,
      includeDirs: [PROTO_ROOT],
      url: config.get('ORDERING_GRPC_URL', { infer: true }),
    });
  }

  listOrders(
    caller: Caller,
    request: ListOrdersRequest,
    requestId?: string,
  ): Promise<ListOrdersResponse> {
    return this.call('listOrders', request, { requestId, caller });
  }

  getAdminOrder(
    caller: Caller,
    request: GetAdminOrderRequest,
    requestId?: string,
  ): Promise<GetAdminOrderResponse> {
    return this.call('getAdminOrder', request, { requestId, caller });
  }
}
