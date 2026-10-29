import type { OrderResponseDto } from '@brewlite/api-client';
import { staffOrdersControllerListBoard } from '@brewlite/api-client';
import { hasPermission, requireStaff } from '@/lib/session';
import { readPage } from '@/lib/api-server';
import StaffBoardClient from './StaffBoardClient';

export const dynamic = 'force-dynamic';

export default async function StaffBoardPage() {
  const user = await requireStaff('/staff');
  let orders: OrderResponseDto[] = [];
  let failed = false;

  try {
    const response = await staffOrdersControllerListBoard();
    orders = readPage<OrderResponseDto>(response.data).rows;
  } catch {
    failed = true;
  }

  return (
    <StaffBoardClient
      orders={orders}
      failed={failed}
      lastUpdated={new Date().toISOString()}
      canUpdate={hasPermission(user, 'order.status.update')}
      canCancel={hasPermission(user, 'order.cancel.paid')}
    />
  );
}
