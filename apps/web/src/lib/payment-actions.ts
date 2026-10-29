'use server';

import { paymentsControllerCreatePayment, type PaymentResponseDto } from '@brewlite/api-client';
import { actionFailure, type ActionResult } from './action-result';
import { unwrap } from './api-server';

/** Starts (or resumes) the one open payment session for an order. */
export async function startPaymentAction(input: {
  orderId: string;
  idempotencyKey: string;
}): Promise<ActionResult<PaymentResponseDto>> {
  if (!input?.orderId || !input.idempotencyKey) {
    return { ok: false, code: 'VALIDATION_FAILED', details: {} };
  }

  try {
    const response = await paymentsControllerCreatePayment(
      { orderId: input.orderId },
      { headers: { 'Idempotency-Key': input.idempotencyKey } },
    );
    return { ok: true, data: unwrap<PaymentResponseDto>(response.data) };
  } catch (error) {
    return actionFailure(error);
  }
}
