'use server';

import {
  adminProductsControllerClearImage,
  adminProductsControllerCreate,
  adminProductsControllerDelete,
  adminProductsControllerReplaceSizes,
  adminProductsControllerReplaceToppings,
  adminProductsControllerRestore,
  adminProductsControllerSetImage,
  adminProductsControllerUpdate,
  type ReplaceSizesDto,
} from '@brewlite/api-client';
import { executeServerAction } from '@/lib/api-server';
import type { MockProduct } from '@/mocks/admin-data';

export async function saveProductAction(product: MockProduct, isNew = false) {
  const hasDesc = Boolean(product.description?.vi?.trim() && product.description?.en?.trim());
  const cleanDescription = hasDesc ? product.description : undefined;

  if (isNew) {
    return executeServerAction(
      () =>
        adminProductsControllerCreate({
          categoryId: product.categoryId,
          name: product.name,
          description: cleanDescription,
          basePriceVnd: product.basePriceVnd,
          sizes: product.sizes,
          toppingIds: product.toppingIds,
          stockQty: product.stockQty,
          sortOrder: product.sortOrder,
        }),
      '/admin/products',
    );
  }
  return executeServerAction(
    () =>
      adminProductsControllerUpdate(product.id, {
        categoryId: product.categoryId,
        name: product.name,
        description: cleanDescription ?? null,
        basePriceVnd: product.basePriceVnd,
        sortOrder: product.sortOrder,
      }),
    `/admin/products/${product.id}`,
  );
}

export async function uploadProductImageAction(productId: string, formData: FormData) {
  return executeServerAction(
    () => adminProductsControllerSetImage(productId, { file: formData.get('file') as File }),
    `/admin/products/${productId}`,
  );
}

export async function replaceProductSizesAction(productId: string, dto: ReplaceSizesDto) {
  return executeServerAction(
    () => adminProductsControllerReplaceSizes(productId, dto),
    `/admin/products/${productId}`,
  );
}

export async function replaceProductToppingsAction(productId: string, toppingIds: string[]) {
  return executeServerAction(
    () => adminProductsControllerReplaceToppings(productId, { toppingIds }),
    `/admin/products/${productId}`,
  );
}

export async function clearProductImageAction(productId: string) {
  return executeServerAction(
    () => adminProductsControllerClearImage(productId),
    `/admin/products/${productId}`,
  );
}

export async function toggleProductDeleteAction(productId: string, shouldRestore: boolean) {
  return executeServerAction(
    () =>
      shouldRestore
        ? adminProductsControllerRestore(productId)
        : adminProductsControllerDelete(productId),
    '/admin/products',
  );
}