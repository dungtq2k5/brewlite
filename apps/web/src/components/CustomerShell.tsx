import type { ReactNode } from 'react';
import { getMe } from '@/lib/me';
import { Header } from './Header';

/** The header plus the page — shared by the `(customer)` and `(auth)` layouts. */
export async function CustomerShell({ children }: Readonly<{ children: ReactNode }>) {
  const me = await getMe();
  return (
    <>
      <Header me={me} />
      <main className="mx-auto w-full max-w-5xl px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {children}
      </main>
    </>
  );
}
