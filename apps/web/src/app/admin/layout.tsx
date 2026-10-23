import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { getMe } from '@/lib/me';

export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  const me = await getMe();
  if (!me?.permissions.includes('menu.manage')) redirect('/');
  return <AdminShell me={me}>{children}</AdminShell>;
}
