import { staffSession } from '@/lib/staff/api';
import { StaffProfile } from '@/components/staff/StaffProfile';
import { StaffFailure } from '@/components/staff/StaffFailure';
export default async function StaffAccountPage() {
  const session = await staffSession();
  return session.ok ? (
    <StaffProfile key={session.data.id} user={session.data} />
  ) : (
    <StaffFailure error={session.error} />
  );
}
