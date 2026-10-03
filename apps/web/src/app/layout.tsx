import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BrewLite — Specialty Coffee & Tea',
  description: 'Cashless Specialty Coffee & Tea Ordering',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" data-theme="brewlite">
      <body className="bg-base-200 text-base-content min-h-screen antialiased">{children}</body>
    </html>
  );
}
