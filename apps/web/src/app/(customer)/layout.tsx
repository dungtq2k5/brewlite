import React from 'react';
import Header from '@/components/Header';
import BuyerFooter from '@/components/BuyerFooter';
import OfflineBanner from '@/components/OfflineBanner';
import { CartProvider } from '@/context/CartContext';
import { getLocale } from '@/i18n/locale.server';

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <CartProvider>
      <div className="buyer-shell">
        <OfflineBanner />
        <Header locale={locale} />
        <main className="buyer-main" id="main">
          {children}
        </main>
        <BuyerFooter />
      </div>
    </CartProvider>
  );
}
