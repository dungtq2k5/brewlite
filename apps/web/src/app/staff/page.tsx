import { redirect } from 'next/navigation';
import { staffOrdersControllerListBoard } from '@brewlite/api-client';
import { Board } from '@/components/staff/Board';
import { getMe } from '@/lib/me';
import { withRequestId } from '@/lib/with-request-id';

/** `/staff` — paid orders, oldest first, in three columns; the staff layout has already gated it. */
export default async function StaffBoardPage() {
  // A counter hand with stock rights only has no board: send them to the stock list.
  const me = await getMe();
  if (!me?.permissions.includes('order.board.read')) redirect('/staff/products');
  const res = await staffOrdersControllerListBoard().catch((error: unknown) => {
    throw withRequestId(error);
  });
  return <Board orders={res.status === 200 ? (res.data.data ?? []) : []} />;
}
