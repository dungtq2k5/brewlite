import AdminShell from '@/components/shells/AdminShell';
import { requireAdmin } from '@/lib/session';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin('/admin');
  return <AdminShell user={user}>{children}</AdminShell>;
}
