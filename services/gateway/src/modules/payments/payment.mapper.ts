import type { Payment } from '@brewlite/contracts/generated/brewlite/payment/payment_service.js';
import type { PaymentResponseDto } from './dto/payment.dto.js';

export function toPaymentResponseDto(payment: Payment): PaymentResponseDto {
  return {
    id: payment.id,
    orderId: payment.orderId,
    status: payment.status as PaymentResponseDto['status'],
    provider: payment.provider as PaymentResponseDto['provider'],
    amountVnd: Number(payment.amountVnd),
    method: payment.method ?? null,
    clientSecret: payment.clientSecret ?? null,
    expiresAt: payment.expiresAt ?? null,
    createdAt: payment.createdAt,
  };
}
