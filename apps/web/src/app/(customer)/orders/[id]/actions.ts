'use server';

import { ordersControllerCancelOrder, type OrderResponseDto } from '@brewlite/api-client';
import { actionFailure, type ActionResult } from '@/lib/action-result';
import { unwrap } from '@/lib/api-server';

/** Cancels an unpaid order; the gateway refuses anything but PENDING / PAYMENT_FAILED. */
export async function cancelOrderAction(id: string): Promise<ActionResult<OrderResponseDto>> {
  if (typeof id !== 'string' || id.length === 0) {
    return { ok: false, code: 'VALIDATION_FAILED', details: {} };
  }

  try {
    const response = await ordersControllerCancelOrder(id);
    return { ok: true, data: unwrap<OrderResponseDto>(response.data) };
  } catch (error) {
    return actionFailure(error);
  }
}
