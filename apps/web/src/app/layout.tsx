import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import type { ReactNode } from 'react';
import tokens from '@/styles/tokens.json';
import { getLocale, getResources } from '@/i18n/server';
import { I18nProvider } from '@/i18n/I18nProvider';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import '@/lib/api';
import '@/styles/app.css';

const font = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-be-vietnam-pro',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: tokens.color.primary.$value,
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: { default: 'BrewLite', template: '%s · BrewLite' },
  applicationName: 'BrewLite',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: { capable: true, title: 'BrewLite', statusBarStyle: 'default' },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const resources = await getResources();
  return (
    <html lang={locale} data-theme="brewlite" className={font.variable}>
      <body className="bg-base-100 text-base-content min-h-dvh font-sans antialiased">
        <I18nProvider locale={locale} resources={resources}>
          {children}
        </I18nProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
