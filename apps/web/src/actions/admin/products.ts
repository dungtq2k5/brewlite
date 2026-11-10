'use server';

import {
  adminCategoriesControllerList,
  adminProductsControllerClearImage,
  adminProductsControllerCreate,
  adminProductsControllerDelete,
  adminProductsControllerReplaceSizes,
  adminProductsControllerReplaceToppings,
  adminProductsControllerRestore,
  adminProductsControllerSetImage,
  adminProductsControllerUpdate,
  type AdminCategoryResponseDto,
  type AdminProductResponseDto,
  type CreateProductDto,
  type ReplaceSizesDto,
  type UpdateProductDto,
} from '@brewlite/api-client';
import { PRODUCT_IMAGE_MAX_BYTES } from '@brewlite/contracts';
import type { ActionResult } from '@/lib/action-result';
import { run, runVoid } from './run';

type Product = AdminProductResponseDto;

export async function createProduct(body: CreateProductDto): Promise<ActionResult<Product>> {
  return run(() => adminProductsControllerCreate(body));
}

export async function updateProduct(
  id: string,
  body: UpdateProductDto,
): Promise<ActionResult<Product>> {
  return run(() => adminProductsControllerUpdate(id, body));
}

export async function replaceSizes(
  id: string,
  body: ReplaceSizesDto,
): Promise<ActionResult<Product>> {
  return run(() => adminProductsControllerReplaceSizes(id, body));
}

export async function replaceToppings(
  id: string,
  body: { toppingIds: string[] },
): Promise<ActionResult<Product>> {
  return run(() => adminProductsControllerReplaceToppings(id, body));
}

/**
 * The photo as a `FormData` with a `file` entry. The uploader has already refused a wrong type or a
 * file over 2 MB; this checks the size again so nothing large is forwarded, and the API checks the
 * bytes themselves (`IMAGE_INVALID`).
 */
export async function setProductImage(id: string, form: FormData): Promise<ActionResult<Product>> {
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0 || file.size > PRODUCT_IMAGE_MAX_BYTES) {
    return { ok: false, code: 'IMAGE_INVALID' };
  }
  return run(() => adminProductsControllerSetImage(id, { file }));
}

export async function clearProductImage(id: string): Promise<ActionResult> {
  return runVoid(() => adminProductsControllerClearImage(id));
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  return runVoid(() => adminProductsControllerDelete(id));
}

/** `INVALID_STATE` with `details.status: 'CATEGORY_DELETED'` when its category is deleted. */
export async function restoreProduct(id: string): Promise<ActionResult<Product>> {
  return run(() => adminProductsControllerRestore(id));
}

/** The categories now (live), for naming a category deleted mid-edit. */
export async function liveCategories(): Promise<ActionResult<AdminCategoryResponseDto[]>> {
  return run(() => adminCategoriesControllerList());
}
