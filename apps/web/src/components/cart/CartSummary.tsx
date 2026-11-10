'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { formatVnd } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';

/**
 * Total, the "prices are confirmed at checkout" line, and one link to `/checkout` — the same for a
 * guest and a customer; the proxy sends a guest to sign in and back. Pinned to the
 * bottom of the screen while the lines scroll.
 */
export function CartSummary({
  itemCount,
  totalVnd,
  signedIn,
}: Readonly<{ itemCount: number; totalVnd: number; signedIn: boolean }>) {
  const { t, i18n } = useTranslation('cart');
  const locale = i18n.language as Locale;
  return (
    <div className="bg-base-100 border-base-300 sticky bottom-0 -mx-4 mt-2 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <p className="font-semibold">
            {t('summary.total')} · {t('items', { count: itemCount })}
          </p>
          <p className="text-xs">{t('summary.note')}</p>
        </div>
        <p className="text-2xl font-extrabold tabular-nums">{formatVnd(totalVnd, locale)}</p>
      </div>
      <Link href="/checkout" prefetch={false} className="btn btn-primary w-full">
        {t(signedIn ? 'summary.checkOut' : 'summary.signInToCheckOut')}
      </Link>
    </div>
  );
}
