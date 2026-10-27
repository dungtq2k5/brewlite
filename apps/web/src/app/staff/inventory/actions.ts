'use server';

import {
  staffProductsControllerSetAvailability,
  staffProductsControllerSetStockQty,
  staffToppingsControllerSetAvailability,
} from '@brewlite/api-client';
import { executeServerAction } from '@/lib/api-server';

export async function updateProductStockAction(
  productId: string,
  stockQty: number | null,
  expectedVersion: number,
) {
  return executeServerAction(
    () =>
      staffProductsControllerSetStockQty(productId, {
        stockQty,
        expectedVersion,
      }),
    '/staff/inventory',
  );
}

export async function setProductAvailabilityAction(productId: string, isAvailable: boolean) {
  return executeServerAction(
    () => staffProductsControllerSetAvailability(productId, { isAvailable }),
    '/staff/inventory',
  );
}

export async function setToppingAvailabilityAction(toppingId: string, isAvailable: boolean) {
  return executeServerAction(
    () => staffToppingsControllerSetAvailability(toppingId, { isAvailable }),
    '/staff/inventory',
  );
}