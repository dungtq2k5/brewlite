import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { StaffShell } from '@/components/StaffShell';
import { getMe } from '@/lib/me';

export default async function StaffLayout({ children }: Readonly<{ children: ReactNode }>) {
  // The gate: the proxy redirected early on the token's role; this re-checks `Me`.
  const me = await getMe();
  const allowed =
    me?.permissions.includes('order.board.read') || me?.permissions.includes('stock.update');
  if (!me || !allowed) redirect('/');
  return <StaffShell me={me}>{children}</StaffShell>;
}
