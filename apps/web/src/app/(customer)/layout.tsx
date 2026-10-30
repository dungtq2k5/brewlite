import React from 'react';
import Header from '@/components/Header';
import BuyerFooter from '@/components/BuyerFooter';
import BottomNav from '@/components/BottomNav';
import OfflineBanner from '@/components/OfflineBanner';
import { CartProvider } from '@/context/CartContext';
import { getLocale } from '@/i18n/locale.server';

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <CartProvider>
      <div className="buyer-shell">
        <a className="skip-link" href="#main">
          {locale === 'vi' ? 'Bỏ qua điều hướng' : 'Skip navigation'}
        </a>
        <OfflineBanner locale={locale} />
        <Header locale={locale} />
        <main className="buyer-main" id="main">
          {children}
        </main>
        <BuyerFooter />
        <BottomNav locale={locale} />
      </div>
    </CartProvider>
  );
}
