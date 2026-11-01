'use server';

import {
  staffOrdersControllerAdvanceStatus,
  staffOrdersControllerCancelPaid,
  staffProductsControllerSetAvailability,
  staffProductsControllerSetStockQty,
  staffToppingsControllerSetAvailability,
  type OrderResponseDto,
  type StaffProductResponseDto,
  type StaffToppingResponseDto,
} from '@brewlite/api-client';
import { CANCEL_NOTE_MAX_LENGTH } from '@brewlite/contracts';
import '@/lib/api';
import { toResult, type ActionResult } from '@/lib/action-result';

/**
 * The counter's writes. Each returns an `ActionResult`: an API refusal (another tablet moved the
 * order, a stale stock version) is a value the screen reads, never a throw (conventions §11.1).
 */

/** `INVALID_STATE` carries `details.status` — the order's real status when someone else moved it. */
export async function advanceOrder(
  id: string,
  to: 'PREPARING' | 'READY' | 'COMPLETED',
): Promise<ActionResult<OrderResponseDto>> {
  const result = await toResult(() => staffOrdersControllerAdvanceStatus(id, { to }));
  if (!result.ok) return result;
  const order = result.data.status === 200 ? result.data.data.data : undefined;
  return order ? { ok: true, data: order } : { ok: false, code: 'INTERNAL' };
}

/** A paid order, cancelled with a reason the customer reads word for word; the refund follows. */
export async function cancelPaidOrder(
  id: string,
  note: string,
): Promise<ActionResult<OrderResponseDto>> {
  const reason = note.trim();
  if (reason === '' || reason.length > CANCEL_NOTE_MAX_LENGTH) {
    return { ok: false, code: 'VALIDATION_FAILED' };
  }
  const result = await toResult(() => staffOrdersControllerCancelPaid(id, { note: reason }));
  if (!result.ok) return result;
  const order = result.data.status === 200 ? result.data.data.data : undefined;
  return order ? { ok: true, data: order } : { ok: false, code: 'INTERNAL' };
}

export async function setProductAvailability(
  id: string,
  isAvailable: boolean,
): Promise<ActionResult<StaffProductResponseDto>> {
  const result = await toResult(() => staffProductsControllerSetAvailability(id, { isAvailable }));
  if (!result.ok) return result;
  const product = result.data.status === 200 ? result.data.data.data : undefined;
  return product ? { ok: true, data: product } : { ok: false, code: 'INTERNAL' };
}

/**
 * `STOCK_VERSION_CONFLICT` carries `details.currentStockQty` / `currentVersion`; nothing is retried
 * here — a person enters their count again (api §2.2).
 */
export async function setProductStock(
  id: string,
  stockQty: number | null,
  expectedVersion: number,
): Promise<ActionResult<StaffProductResponseDto>> {
  const result = await toResult(() =>
    staffProductsControllerSetStockQty(id, { stockQty, expectedVersion }),
  );
  if (!result.ok) return result;
  const product = result.data.status === 200 ? result.data.data.data : undefined;
  return product ? { ok: true, data: product } : { ok: false, code: 'INTERNAL' };
}

export async function setToppingAvailability(
  id: string,
  isAvailable: boolean,
): Promise<ActionResult<StaffToppingResponseDto>> {
  const result = await toResult(() => staffToppingsControllerSetAvailability(id, { isAvailable }));
  if (!result.ok) return result;
  const topping = result.data.status === 200 ? result.data.data.data : undefined;
  return topping ? { ok: true, data: topping } : { ok: false, code: 'INTERNAL' };
}
