'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { formatVnd } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';

/**
 * Total, the "prices are confirmed at checkout" line, and one link to `/checkout` — the same for a
 * guest and a customer; the proxy sends a guest to sign in and back. Fixed to the
 * bottom of the screen (the frame's sticky summary), whether or not the lines fill it.
 */
export function CartSummary({
  itemCount,
  totalVnd,
  signedIn,
}: Readonly<{ itemCount: number; totalVnd: number; signedIn: boolean }>) {
  const { t, i18n } = useTranslation('cart');
  const locale = i18n.language as Locale;
  return (
    <div className="bg-base-100 border-base-300 fixed inset-x-0 bottom-0 z-30 border-t px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-4px_8px_rgba(43,33,28,0.08)]">
      <div className="mx-auto flex max-w-[30rem] flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-base leading-6 font-semibold">
              {t('summary.total')} · {t('items', { count: itemCount })}
            </p>
            <p className="text-base-content/72 text-[13px] leading-[18px]">{t('summary.note')}</p>
          </div>
          <p className="text-2xl leading-8 font-bold tabular-nums">{formatVnd(totalVnd, locale)}</p>
        </div>
        <Link href="/checkout" prefetch={false} className="btn btn-primary w-full">
          {t(signedIn ? 'summary.checkOut' : 'summary.signInToCheckOut')}
        </Link>
      </div>
    </div>
  );
}
