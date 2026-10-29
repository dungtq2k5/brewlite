import StaffShell from '@/components/shells/StaffShell';
import { requireStaff } from '@/lib/session';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff('/staff');
  return <StaffShell user={user}>{children}</StaffShell>;
}
