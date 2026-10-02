import { Injectable } from '@nestjs/common';
import type { Caller } from '@brewlite/nest-common';
import type { UserContext } from '../../auth/request-context.js';
import { toPaymentResponseDto } from './payment.mapper.js';
import { PaymentServiceGrpcClient } from './payment-service-grpc.client.js';
import type { CreatePaymentDto, FakeConfirmDto, PaymentResponseDto } from './dto/payment.dto.js';

function toCaller(ctx: UserContext): Caller {
  return { kind: 'USER', userId: ctx.userId, role: ctx.role };
}

@Injectable()
export class PaymentsService {
  constructor(private readonly payment: PaymentServiceGrpcClient) {}

  async createPayment(
    dto: CreatePaymentDto,
    idempotencyKey: string,
    ctx: UserContext,
    requestId?: string,
  ): Promise<{ payment: PaymentResponseDto; created: boolean }> {
    const response = await this.payment.createPayment(
      toCaller(ctx),
      { orderId: dto.orderId, idempotencyKey },
      requestId,
    );
    return { payment: toPaymentResponseDto(response.payment!), created: response.created };
  }

  async getPayment(id: string, ctx: UserContext, requestId?: string): Promise<PaymentResponseDto> {
    const response = await this.payment.getPayment(toCaller(ctx), { id }, requestId);
    return toPaymentResponseDto(response.payment!);
  }

  async fakeConfirm(
    id: string,
    dto: FakeConfirmDto,
    ctx: UserContext,
    requestId?: string,
  ): Promise<PaymentResponseDto> {
    const response = await this.payment.fakeConfirm(
      toCaller(ctx),
      { id, outcome: dto.outcome },
      requestId,
    );
    return toPaymentResponseDto(response.payment!);
  }
}
