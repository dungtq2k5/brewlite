'use server';

import {
  ordersControllerPlaceOrder,
  ordersControllerQuote,
  type OrderResponseDto,
  type QuoteDto,
  type QuoteResponseDto,
} from '@brewlite/api-client';
import { actionFailure, type ActionResult } from '@/lib/action-result';
import { unwrap } from '@/lib/api-server';

const VALIDATION_FAILED = { ok: false, code: 'VALIDATION_FAILED', details: {} } as const;

function validItems(items: QuoteDto['items'] | undefined): boolean {
  return (
    Array.isArray(items) &&
    items.length > 0 &&
    items.every(
      (item) =>
        typeof item?.productId === 'string' &&
        item.productId.length > 0 &&
        Array.isArray(item.toppingIds) &&
        Number.isInteger(item.qty) &&
        item.qty >= 1,
    )
  );
}

function quoteBody(input: QuoteDto): QuoteDto {
  const body: QuoteDto = { items: input.items };
  const promoCode = input.promoCode?.trim().toUpperCase();
  if (promoCode) body.promoCode = promoCode;
  return body;
}

/** Prices the cart on the server; the browser never trusts its own preview total. */
export async function quoteOrderAction(input: QuoteDto): Promise<ActionResult<QuoteResponseDto>> {
  if (!input || !validItems(input.items)) return VALIDATION_FAILED;

  try {
    const response = await ordersControllerQuote(quoteBody(input));
    return { ok: true, data: unwrap<QuoteResponseDto>(response.data) };
  } catch (error) {
    return actionFailure(error);
  }
}

/** Places one order per user intent; the client supplies the key it will reuse on retry. */
export async function placeOrderAction(
  input: QuoteDto & { idempotencyKey: string },
): Promise<ActionResult<OrderResponseDto>> {
  if (!input || !validItems(input.items) || !input.idempotencyKey) return VALIDATION_FAILED;

  try {
    const response = await ordersControllerPlaceOrder(quoteBody(input), {
      headers: { 'Idempotency-Key': input.idempotencyKey },
    });
    return { ok: true, data: unwrap<OrderResponseDto>(response.data) };
  } catch (error) {
    return actionFailure(error);
  }
}
