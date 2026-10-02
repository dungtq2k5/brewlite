import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseGrpcClient } from '@brewlite/nest-common';
import { ORDERING_PROTO_FILES, PROTO_ROOT } from '@brewlite/contracts/proto-paths.js';
import type {
  GetOrderStatusRequest,
  GetOrderStatusResponse,
} from '@brewlite/contracts/generated/brewlite/ordering/order_service.js';
import type { Env } from '../../config/env.schema.js';

/** Only `GetOrderStatus`, for the orphan sweep (api §9.2) — internal, no caller identity. */
@Injectable()
export class OrderingOrderGrpcClient extends BaseGrpcClient {
  constructor(config: ConfigService<Env, true>) {
    super({
      serviceName: 'brewlite.ordering.OrderService',
      protoFiles: ORDERING_PROTO_FILES,
      includeDirs: [PROTO_ROOT],
      url: config.get('ORDERING_GRPC_URL', { infer: true }),
    });
  }

  getOrderStatus(
    request: GetOrderStatusRequest,
    requestId?: string,
  ): Promise<GetOrderStatusResponse> {
    return this.call('getOrderStatus', request, { requestId });
  }
}
