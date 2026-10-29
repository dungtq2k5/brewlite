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
import { revalidatePath } from 'next/cache';
import { actionFailure, type ActionResult } from './action-result';
import { unwrap } from './api-server';

type AdvanceTarget = 'PREPARING' | 'READY' | 'COMPLETED';

const ADVANCE_TARGETS: ReadonlySet<string> = new Set(['PREPARING', 'READY', 'COMPLETED']);
const STOCK_MAX = 2_147_483_647;

function invalid(): ActionResult<never> {
  return { ok: false, code: 'VALIDATION_FAILED', details: {} };
}

function isOrderId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** `PAID → PREPARING → READY → COMPLETED`; the gateway refuses anything else with `INVALID_STATE`. */
export async function advanceStaffOrderAction(input: {
  orderId: string;
  to: AdvanceTarget;
}): Promise<ActionResult<OrderResponseDto>> {
  if (!isOrderId(input?.orderId) || !ADVANCE_TARGETS.has(input.to)) return invalid();

  try {
    const response = await staffOrdersControllerAdvanceStatus(input.orderId, { to: input.to });
    revalidatePath('/staff');
    return { ok: true, data: unwrap<OrderResponseDto>(response.data) };
  } catch (error) {
    return actionFailure(error);
  }
}

/** Only a `PAID` order can be cancelled, and only with a non-empty reason. */
export async function cancelPaidOrderAction(input: {
  orderId: string;
  note: string;
}): Promise<ActionResult<OrderResponseDto>> {
  const note = typeof input?.note === 'string' ? input.note.trim() : '';
  if (!isOrderId(input?.orderId) || note.length === 0 || note.length > CANCEL_NOTE_MAX_LENGTH) {
    return invalid();
  }

  try {
    const response = await staffOrdersControllerCancelPaid(input.orderId, { note });
    revalidatePath('/staff');
    return { ok: true, data: unwrap<OrderResponseDto>(response.data) };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function setProductAvailabilityAction(input: {
  productId: string;
  isAvailable: boolean;
}): Promise<ActionResult<StaffProductResponseDto>> {
  if (!isOrderId(input?.productId) || typeof input.isAvailable !== 'boolean') return invalid();

  try {
    const response = await staffProductsControllerSetAvailability(input.productId, {
      isAvailable: input.isAvailable,
    });
    revalidatePath('/staff/stock');
    return { ok: true, data: unwrap<StaffProductResponseDto>(response.data) };
  } catch (error) {
    return actionFailure(error);
  }
}

/** `stockQty: null` means the product is not stock-tracked. */
export async function setProductStockAction(input: {
  productId: string;
  stockQty: number | null;
  expectedVersion: number;
}): Promise<ActionResult<StaffProductResponseDto>> {
  if (
    !isOrderId(input?.productId) ||
    !Number.isInteger(input.expectedVersion) ||
    input.expectedVersion < 0 ||
    (input.stockQty !== null &&
      (!Number.isInteger(input.stockQty) || input.stockQty < 0 || input.stockQty > STOCK_MAX))
  ) {
    return invalid();
  }

  try {
    const response = await staffProductsControllerSetStockQty(input.productId, {
      stockQty: input.stockQty,
      expectedVersion: input.expectedVersion,
    });
    revalidatePath('/staff/stock');
    return { ok: true, data: unwrap<StaffProductResponseDto>(response.data) };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function setToppingAvailabilityAction(input: {
  toppingId: string;
  isAvailable: boolean;
}): Promise<ActionResult<StaffToppingResponseDto>> {
  if (!isOrderId(input?.toppingId) || typeof input.isAvailable !== 'boolean') return invalid();

  try {
    const response = await staffToppingsControllerSetAvailability(input.toppingId, {
      isAvailable: input.isAvailable,
    });
    revalidatePath('/staff/stock');
    return { ok: true, data: unwrap<StaffToppingResponseDto>(response.data) };
  } catch (error) {
    return actionFailure(error);
  }
}
