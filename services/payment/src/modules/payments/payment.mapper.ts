import type { Payment as PaymentRow } from '../../../generated/prisma/client.js';
import type { Payment } from '@brewlite/contracts/generated/brewlite/payment/payment_service.js';

/** `clientSecret` is present only while `PENDING` with provider `STRIPE` (api §4) — always `null` until 08. */
export function toProtoPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    orderId: row.orderId,
    status: row.status,
    provider: row.provider,
    amountVnd: row.amountVnd.toString(),
    method: row.method ?? undefined,
    clientSecret: undefined,
    expiresAt: row.expiresAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}
