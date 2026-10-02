import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseGrpcClient } from '@brewlite/nest-common';
import { PAYMENT_PROTO_FILES, PROTO_ROOT } from '@brewlite/contracts/proto-paths.js';
import type {
  HandleStripeEventRequest,
  HandleStripeEventResponse,
} from '@brewlite/contracts/generated/brewlite/payment/webhook_service.js';
import type { Env } from '../../config/env.schema.js';

/** A longer deadline than the default 2 s: handling an event may make one Stripe API call. */
const WEBHOOK_DEADLINE_MS = 10_000;

@Injectable()
export class WebhookServiceGrpcClient extends BaseGrpcClient {
  constructor(config: ConfigService<Env, true>) {
    super({
      serviceName: 'brewlite.payment.WebhookService',
      protoFiles: PAYMENT_PROTO_FILES,
      includeDirs: [PROTO_ROOT],
      url: config.get('PAYMENT_GRPC_URL', { infer: true }),
    });
  }

  handleStripeEvent(
    request: HandleStripeEventRequest,
    requestId?: string,
  ): Promise<HandleStripeEventResponse> {
    return this.call('handleStripeEvent', request, { requestId, deadlineMs: WEBHOOK_DEADLINE_MS });
  }
}
