import { Controller, UseInterceptors } from '@nestjs/common';
import type { Metadata } from '@grpc/grpc-js';
import { callerFrom, GrpcRequestContextInterceptor } from '@brewlite/nest-common';
import {
  PaymentServiceControllerMethods,
  type CreatePaymentRequest,
  type CreatePaymentResponse,
  type FakeConfirmRequest,
  type FakeConfirmResponse,
  type GetPaymentRequest,
  type GetPaymentResponse,
  type PaymentServiceController,
} from '@brewlite/contracts/generated/brewlite/payment/payment_service.js';
import { PaymentsService } from './payments.service.js';

@Controller()
@PaymentServiceControllerMethods()
@UseInterceptors(GrpcRequestContextInterceptor)
export class PaymentsGrpcController implements PaymentServiceController {
  constructor(private readonly payments: PaymentsService) {}

  createPayment(
    request: CreatePaymentRequest,
    metadata?: Metadata,
  ): Promise<CreatePaymentResponse> {
    return this.payments.createPayment(request, callerFrom(metadata));
  }

  getPayment(request: GetPaymentRequest, metadata?: Metadata): Promise<GetPaymentResponse> {
    return this.payments.getPayment(request, callerFrom(metadata));
  }

  fakeConfirm(request: FakeConfirmRequest, metadata?: Metadata): Promise<FakeConfirmResponse> {
    return this.payments.fakeConfirm(request, callerFrom(metadata));
  }
}
