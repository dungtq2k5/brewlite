import React from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import OfflineBanner from '@/components/OfflineBanner';
import { CartProvider } from '@/context/CartContext';

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="min-h-screen bg-[#F5EFE6] text-[#2B1E16] flex flex-col font-sans">
        <OfflineBanner />
        <Header />
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-4 pb-24">{children}</main>
        <BottomNav />
      </div>
    </CartProvider>
  );
}
