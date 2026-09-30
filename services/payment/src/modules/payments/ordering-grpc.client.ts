import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseGrpcClient } from '@brewlite/nest-common';
import { ORDERING_PROTO_FILES, PROTO_ROOT } from '@brewlite/contracts/proto-paths.js';
import type {
  BeginPaymentRequest,
  BeginPaymentResponse,
} from '@brewlite/contracts/generated/brewlite/ordering/order_service.js';
import type { Env } from '../../config/env.schema.js';

/** Only `BeginPayment` — internal, no gateway route, no caller identity (api §9.2). */
@Injectable()
export class OrderingGrpcClient extends BaseGrpcClient {
  constructor(config: ConfigService<Env, true>) {
    super({
      serviceName: 'brewlite.ordering.OrderService',
      protoFiles: ORDERING_PROTO_FILES,
      includeDirs: [PROTO_ROOT],
      url: config.get('ORDERING_GRPC_URL', { infer: true }),
    });
  }

  beginPayment(request: BeginPaymentRequest, requestId?: string): Promise<BeginPaymentResponse> {
    return this.call('beginPayment', request, { requestId, deadlineMs: 2000 });
  }
}
