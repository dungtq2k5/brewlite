'use server';

import {
  adminToppingsControllerCreate,
  adminToppingsControllerDelete,
  adminToppingsControllerRestore,
  adminToppingsControllerUpdate,
} from '@brewlite/api-client';
import { executeServerAction } from '@/lib/api-server';
import type { MockTopping } from '@/mocks/admin-data';

export async function saveToppingAction(payload: MockTopping, isNew = false) {
  if (isNew) {
    return executeServerAction(
      () =>
        adminToppingsControllerCreate({
          name: payload.name,
          priceVnd: payload.priceVnd,
        }),
      '/admin/toppings',
    );
  }
  return executeServerAction(
    () =>
      adminToppingsControllerUpdate(payload.id, {
        name: payload.name,
        priceVnd: payload.priceVnd,
        isAvailable: payload.isAvailable,
      }),
    '/admin/toppings',
  );
}

export async function toggleToppingDeleteAction(id: string, shouldRestore: boolean) {
  return executeServerAction(
    () =>
      shouldRestore
        ? adminToppingsControllerRestore(id)
        : adminToppingsControllerDelete(id),
    '/admin/toppings',
  );
}