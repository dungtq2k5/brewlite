import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseGrpcClient, type Caller } from '@brewlite/nest-common';
import { PAYMENT_PROTO_FILES, PROTO_ROOT } from '@brewlite/contracts/proto-paths.js';
import type {
  CreatePaymentRequest,
  CreatePaymentResponse,
  FakeConfirmRequest,
  FakeConfirmResponse,
  GetPaymentRequest,
  GetPaymentResponse,
} from '@brewlite/contracts/generated/brewlite/payment/payment_service.js';
import type { Env } from '../../config/env.schema.js';

/** `CreatePayment` makes a Stripe call inside payment (6 s timeout) after `BeginPayment` (2 s). */
const CREATE_PAYMENT_DEADLINE_MS = 12_000;

@Injectable()
export class PaymentServiceGrpcClient extends BaseGrpcClient {
  constructor(config: ConfigService<Env, true>) {
    super({
      serviceName: 'brewlite.payment.PaymentService',
      protoFiles: PAYMENT_PROTO_FILES,
      includeDirs: [PROTO_ROOT],
      url: config.get('PAYMENT_GRPC_URL', { infer: true }),
    });
  }

  createPayment(
    caller: Caller,
    request: CreatePaymentRequest,
    requestId?: string,
  ): Promise<CreatePaymentResponse> {
    return this.call('createPayment', request, {
      requestId,
      caller,
      deadlineMs: CREATE_PAYMENT_DEADLINE_MS,
    });
  }

  getPayment(
    caller: Caller,
    request: GetPaymentRequest,
    requestId?: string,
  ): Promise<GetPaymentResponse> {
    return this.call('getPayment', request, { requestId, caller });
  }

  fakeConfirm(
    caller: Caller,
    request: FakeConfirmRequest,
    requestId?: string,
  ): Promise<FakeConfirmResponse> {
    return this.call('fakeConfirm', request, { requestId, caller });
  }
}
