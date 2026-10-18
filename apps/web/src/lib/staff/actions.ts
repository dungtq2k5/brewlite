'use server';
import { revalidatePath } from 'next/cache';
import {
  staffProductsControllerSetAvailability,
  staffToppingsControllerSetAvailability,
  staffProductsControllerSetStockQty,
  staffOrdersControllerAdvanceStatus,
  staffOrdersControllerCancelPaid,
  usersControllerUpdate,
} from '@brewlite/api-client';
import {
  StaffProductsControllerSetAvailabilityParams,
  StaffProductsControllerSetAvailabilityBody,
  StaffProductsControllerSetAvailabilityResponse,
  StaffProductsControllerSetStockQtyBody,
  StaffProductsControllerSetStockQtyResponse,
  StaffToppingsControllerSetAvailabilityResponse,
  StaffOrdersControllerAdvanceStatusBody,
  StaffOrdersControllerAdvanceStatusResponse,
  StaffOrdersControllerCancelPaidBody,
  StaffOrdersControllerCancelPaidResponse,
  UsersControllerUpdateBody,
  UsersControllerUpdateResponse,
} from './contracts';
import type {
  InventoryTab,
  InventoryProduct,
  InventoryTopping,
  Order,
  StaffUser,
  Result,
} from './contracts';
import { loadInventory, requireStaff, staffError } from './api';
const staffId = StaffProductsControllerSetAvailabilityParams.shape.id.regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
);
const validId = (id: string) => staffId.safeParse(id).success;
export async function refreshInventory() {
  return loadInventory();
}
export async function setInventoryAvailability(
  tab: InventoryTab,
  id: string,
  value: boolean,
): Promise<Result<InventoryProduct | InventoryTopping>> {
  try {
    await requireStaff('stock.update');
    const body = StaffProductsControllerSetAvailabilityBody.strict().safeParse({
      isAvailable: value,
    });
    if (!validId(id) || !body.success || !['products', 'toppings'].includes(tab))
      return { ok: false, error: 'invalidInput' };
    if (tab === 'products') {
      const response = await staffProductsControllerSetAvailability(id, body.data);
      const data = StaffProductsControllerSetAvailabilityResponse.required().parse(
        response.data,
      ).data;
      revalidatePath('/staff/stocks');
      return { ok: true, data };
    }
    const response = await staffToppingsControllerSetAvailability(id, body.data);
    const data = StaffToppingsControllerSetAvailabilityResponse.required().parse(
      response.data,
    ).data;
    revalidatePath('/staff/stocks');
    return { ok: true, data };
  } catch (cause) {
    return { ok: false, error: staffError(cause) };
  }
}
export async function saveInventoryQuantity(
  id: string,
  input: unknown,
  availability: boolean,
): Promise<Result<InventoryProduct>> {
  try {
    await requireStaff('stock.update');
    const parsed = StaffProductsControllerSetStockQtyBody.strict().safeParse(input);
    const flag = StaffProductsControllerSetAvailabilityBody.safeParse({
      isAvailable: availability,
    });
    if (!validId(id) || !parsed.success || !flag.success)
      return { ok: false, error: 'invalidInput' };
    const desired = parsed.data.stockQty !== 0 && flag.data.isAvailable;
    if (!desired) {
      const disabled = await staffProductsControllerSetAvailability(id, { isAvailable: false });
      StaffProductsControllerSetAvailabilityResponse.required().parse(disabled.data);
    }
    const response = await staffProductsControllerSetStockQty(id, parsed.data);
    let data = StaffProductsControllerSetStockQtyResponse.required().parse(response.data).data;
    if (data.isAvailable !== desired) {
      const response = await staffProductsControllerSetAvailability(id, { isAvailable: desired });
      data = StaffProductsControllerSetAvailabilityResponse.required().parse(response.data).data;
    }
    revalidatePath('/staff/stocks');
    return { ok: true, data };
  } catch (cause) {
    revalidatePath('/staff/stocks');
    return { ok: false, error: staffError(cause) };
  }
}
export async function advanceStaffOrder(id: string, input: unknown): Promise<Result<Order>> {
  try {
    await requireStaff('order.status.update');
    const parsed = StaffOrdersControllerAdvanceStatusBody.strict().safeParse(input);
    if (!validId(id) || !parsed.success) return { ok: false, error: 'invalidInput' };
    const response = await staffOrdersControllerAdvanceStatus(id, parsed.data);
    const data = StaffOrdersControllerAdvanceStatusResponse.required().parse(response.data).data;
    revalidatePath('/staff');
    return { ok: true, data };
  } catch (cause) {
    return { ok: false, error: staffError(cause) };
  }
}
export async function cancelStaffOrder(id: string, input: unknown): Promise<Result<Order>> {
  try {
    await requireStaff('order.cancel.paid');
    const parsed = StaffOrdersControllerCancelPaidBody.extend({
      note: StaffOrdersControllerCancelPaidBody.shape.note
        .transform((value) => value.normalize('NFC').trim())
        .refine((value) => value.length > 0 && value.length <= 200),
    })
      .strict()
      .safeParse(input);
    if (!validId(id) || !parsed.success) return { ok: false, error: 'invalidInput' };
    const response = await staffOrdersControllerCancelPaid(id, parsed.data);
    const data = StaffOrdersControllerCancelPaidResponse.required().parse(response.data).data;
    revalidatePath('/staff');
    return { ok: true, data };
  } catch (cause) {
    return { ok: false, error: staffError(cause) };
  }
}
export async function saveStaffProfile(input: unknown): Promise<Result<StaffUser>> {
  try {
    await requireStaff();
    const parsed = UsersControllerUpdateBody.extend({
      fullName: UsersControllerUpdateBody.shape.fullName
        .unwrap()
        .transform((value) => value.normalize('NFC').trim())
        .refine((value) => value.length > 0 && value.length <= 100),
    })
      .strict()
      .safeParse(input);
    if (!parsed.success) return { ok: false, error: 'invalidInput' };
    const response = await usersControllerUpdate(parsed.data);
    const data = UsersControllerUpdateResponse.required().parse(response.data).data;
    revalidatePath('/staff', 'layout');
    return { ok: true, data };
  } catch (cause) {
    return { ok: false, error: staffError(cause) };
  }
}
