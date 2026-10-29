'use server';

import {
  adminProductsControllerClearImage,
  adminProductsControllerSetImage,
  type SetProductImageResponseDto,
} from '@brewlite/api-client';
import { PRODUCT_IMAGE_MAX_BYTES } from '@brewlite/contracts';
import { revalidatePath } from 'next/cache';
import { actionFailure, type ActionResult } from './action-result';
import { unwrap } from './api-server';

const IMAGE_TYPES: ReadonlySet<string> = new Set(['image/jpeg', 'image/png', 'image/webp']);

function invalid(): ActionResult<never> {
  return { ok: false, code: 'IMAGE_INVALID', details: {} };
}

/** The gateway validates the bytes too; this is the fast, friendly check in the browser's request. */
export async function uploadProductImageAction(
  formData: FormData,
): Promise<ActionResult<{ imageUrl: string | null }>> {
  const productId = formData.get('productId');
  const file = formData.get('file');

  if (typeof productId !== 'string' || productId.length === 0) {
    return { ok: false, code: 'VALIDATION_FAILED', details: {} };
  }
  if (!(file instanceof File) || file.size === 0) return invalid();
  if (!IMAGE_TYPES.has(file.type) || file.size > PRODUCT_IMAGE_MAX_BYTES) return invalid();

  try {
    const response = await adminProductsControllerSetImage(productId, { file });
    revalidatePath('/admin/products');
    return { ok: true, data: unwrap<SetProductImageResponseDto>(response.data) };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function removeProductImageAction(
  productId: string,
): Promise<ActionResult<{ imageUrl: null }>> {
  if (typeof productId !== 'string' || productId.length === 0) {
    return { ok: false, code: 'VALIDATION_FAILED', details: {} };
  }

  try {
    await adminProductsControllerClearImage(productId);
    revalidatePath('/admin/products');
    return { ok: true, data: { imageUrl: null } };
  } catch (error) {
    return actionFailure(error);
  }
}
