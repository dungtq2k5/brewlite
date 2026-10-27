import type { ReactNode } from 'react';
import { LocaleProvider } from '@/i18n/locale-context';
import './globals.css';

export const metadata = {
  title: 'BrewLite — Cà Phê & Trà (Administration)',
  description: 'Hệ thống quản trị cửa hàng BrewLite Cà Phê & Trà',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" data-theme="brewlite" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-[#F5EFE6] text-[#4E311E] antialiased overflow-x-hidden"
      >
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}