'use server';

import {
  staffOrdersControllerAdvanceStatus,
  staffOrdersControllerCancelPaid,
  type AdvanceStatusDtoTo,
} from '@brewlite/api-client';
import { executeServerAction } from '@/lib/api-server';
import type { OrderStatus } from '@/mocks/admin-data';

export async function updateOrderStatusAction(orderId: string, to: OrderStatus) {
  return executeServerAction(
    () =>
      staffOrdersControllerAdvanceStatus(orderId, {
        to: to as AdvanceStatusDtoTo,
      }),
    '/staff/orders',
  );
}

export async function cancelPaidOrderAction(orderId: string, note: string) {
  return executeServerAction(
    () => staffOrdersControllerCancelPaid(orderId, { note }),
    '/staff/orders',
  );
}