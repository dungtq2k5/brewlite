import type { ReactNode } from 'react';
import { CustomerShell } from '@/components/CustomerShell';

export default function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <CustomerShell>{children}</CustomerShell>;
}
