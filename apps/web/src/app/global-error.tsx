'use client';

import { Be_Vietnam_Pro } from 'next/font/google';
import { ErrorView } from '@/components/ErrorView';
import en from '@/i18n/locales/en/common.json';
import vi from '@/i18n/locales/vi/common.json';
import '@/styles/app.css';

const font = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '700'],
  variable: '--font-be-vietnam-pro',
});

/**
 * Rendered when the root layout itself fails, so there is no provider: both languages are read
 * straight from the JSON and the cookie decides (a hard failure still speaks the visitor's language).
 */
export default function GlobalError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  const vietnamese =
    typeof document !== 'undefined' && /(?:^|; )bl_locale=vi/.test(document.cookie);
  const words = vietnamese ? vi : en;
  return (
    <html lang={vietnamese ? 'vi' : 'en'} data-theme="brewlite" className={font.variable}>
      <body className="bg-base-100 text-base-content font-sans">
        <ErrorView
          title={words.error.title}
          body={words.error.body}
          retryLabel={words.error.retry}
          onRetry={reset}
          home={
            // Not a <Link>: the router may be the thing that broke.
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => (window.location.href = '/')}
            >
              {words.error.home}
            </button>
          }
          reference={
            error.digest ? words.error.reference.replace('{{id}}', error.digest) : undefined
          }
        />
      </body>
    </html>
  );
}
