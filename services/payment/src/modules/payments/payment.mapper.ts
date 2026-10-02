import type { Payment as PaymentRow } from '../../../generated/prisma/client.js';
import type { Payment } from '@brewlite/contracts/generated/brewlite/payment/payment_service.js';

/** `clientSecret` is present only while `PENDING` with provider `STRIPE` (api §4) — `null` for the fake provider. */
export function toProtoPayment(row: PaymentRow, clientSecret: string | null = null): Payment {
  return {
    id: row.id,
    orderId: row.orderId,
    status: row.status,
    provider: row.provider,
    amountVnd: row.amountVnd.toString(),
    method: row.method ?? undefined,
    clientSecret: clientSecret ?? undefined,
    expiresAt: row.expiresAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}
