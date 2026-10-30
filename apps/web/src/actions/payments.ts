'use server';

import { paymentsControllerCreatePayment, type PaymentResponseDto } from '@brewlite/api-client';
import { parseServerEnv } from '@/config/env.schema';
import { toResult, type ActionResult } from '@/lib/action-result';
import '@/lib/api';
import { requestHeaders } from '@/lib/request-headers';

/**
 * Starts (or finds) the order's payment. `201` a new one, `200` the same key replayed *or the
 * order's open PENDING payment* whatever the key — so an arrival, a reload and a second tab never
 * make two (api §4).
 */
export async function startPayment(
  orderId: string,
  idempotencyKey: string,
): Promise<ActionResult<PaymentResponseDto>> {
  const result = await toResult(() =>
    paymentsControllerCreatePayment(
      { orderId },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    ),
  );
  if (!result.ok) return result;
  const response = result.data;
  const payment =
    response.status === 200 || response.status === 201 ? response.data.data : undefined;
  return payment ? { ok: true, data: payment } : { ok: false, code: 'INTERNAL' };
}

/**
 * `POST /payments/:id/fake-confirm` — excluded from OpenAPI by design (the generated client must
 * never offer it), so this is a hand-written fetch, the third exception to "no hand-written fetch
 * to the API" (conventions §11.1). The gateway answers 404 when the provider is not the fake one.
 */
export async function fakeConfirm(
  paymentId: string,
  outcome: 'SUCCEEDED' | 'FAILED',
): Promise<ActionResult> {
  try {
    const response = await fetch(`${parseServerEnv().API_URL}/payments/${paymentId}/fake-confirm`, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...(await requestHeaders()) },
      body: JSON.stringify({ outcome }),
    });
    if (response.ok) return { ok: true, data: undefined };
    const envelope = (await response.json().catch(() => null)) as {
      error?: { code?: string; details?: unknown };
    } | null;
    return {
      ok: false,
      code: envelope?.error?.code ?? 'INTERNAL',
      details: envelope?.error?.details,
    };
  } catch {
    return { ok: false, code: 'INTERNAL' };
  }
}
