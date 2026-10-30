import type { ReactNode } from 'react';
import { CartProvider } from '@/lib/cart/CartProvider';
import { getMe } from '@/lib/me';
import { Header } from './Header';
import { PathTracker } from './PathTracker';
import { ToastProvider } from './Toast';

/**
 * The header plus the page — shared by the `(customer)` and `(auth)` layouts, and the 404.
 * The cart provider is here so the header's badge and every customer page read one cart.
 */
export async function CustomerShell({ children }: Readonly<{ children: ReactNode }>) {
  const me = await getMe();
  return (
    <CartProvider>
      <ToastProvider>
        <PathTracker>
          <Header me={me} />
          <main className="mx-auto w-full max-w-[70rem] px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {children}
          </main>
        </PathTracker>
      </ToastProvider>
    </CartProvider>
  );
}
