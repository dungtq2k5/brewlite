import type { ReactNode } from 'react';
import { staffPageSession } from '@/lib/staff/api';
import { StaffLanguageProvider } from '@/components/staff/i18n';
import { StaffShell } from '@/components/staff/StaffShell';
import { StaffFailure } from '@/components/staff/StaffFailure';
export default async function StaffLayout({ children }: { children: ReactNode }) {
  const session = await staffPageSession();
  return (
    <StaffLanguageProvider>
      {session.ok ? (
        <StaffShell user={session.data}>{children}</StaffShell>
      ) : (
        <StaffFailure error={session.error} />
      )}
    </StaffLanguageProvider>
  );
}
