import './globals.css';
import type { Metadata } from 'next';
import { Grenze, Grenze_Gotisch, Hanken_Grotesk } from 'next/font/google';
import { cookies } from 'next/headers';
import { LOCALE_COOKIE, normalizeLocale } from '@/i18n/locale';

const grenzeGotisch = Grenze_Gotisch({
  subsets: ['latin', 'vietnamese'],
  weight: '600',
  variable: '--font-grenze-gotisch',
  display: 'swap',
});

const grenze = Grenze({
  subsets: ['latin', 'vietnamese'],
  weight: '400',
  variable: '--font-grenze',
  display: 'swap',
});

const hankenGrotesk = Hanken_Grotesk({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600'],
  variable: '--font-hanken-grotesk',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'BrewLite — Specialty Coffee & Tea',
  description: 'Cashless Specialty Coffee & Tea Ordering',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value);

  return (
    <html
      lang={locale}
      className={`${grenzeGotisch.variable} ${grenze.variable} ${hankenGrotesk.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
