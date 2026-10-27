import type { ReactNode } from 'react';
import { AdminShell } from '@/components/layout/admin-shell';
import { getServerUser } from '@/lib/api-server';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getServerUser();
  return <AdminShell currentUser={user}>{children}</AdminShell>;
}