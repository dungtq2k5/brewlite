import { loadOrders, staffSession } from '@/lib/staff/api';
import { StaffOrdersBoard } from '@/components/staff/orders/StaffOrdersBoard';
import { StaffFailure } from '@/components/staff/StaffFailure';
export default async function StaffOrdersPage() {
  const session = await staffSession();
  if (!session.ok) return <StaffFailure error={session.error} />;
  return <StaffOrdersBoard initial={await loadOrders()} permissions={session.data.permissions} />;
}
