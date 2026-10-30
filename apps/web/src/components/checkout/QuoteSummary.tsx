'use client';

import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatVnd } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';

/**
 * Subtotal, promo, total — the server's numbers (a quote, or a placed order's). With `null`
 * amounts nothing is priced and the summary says so; `pointsEarnable` is shown only at checkout.
 */
export function QuoteSummary({
  subtotalVnd,
  promoCode,
  promoDiscountVnd,
  totalVnd,
  pointsEarnable,
  showPoints = false,
}: Readonly<{
  subtotalVnd: number | null;
  promoCode: string | null;
  promoDiscountVnd: number;
  totalVnd: number | null;
  pointsEarnable?: number | null;
  showPoints?: boolean;
}>) {
  const { t, i18n } = useTranslation('checkout');
  const locale = i18n.language as Locale;
  const money = (amount: number | null) =>
    amount === null ? t('summary.unpriced') : formatVnd(amount, locale);

  return (
    <div className="border-base-300 bg-base-100 rounded-box border p-4">
      <dl className="flex flex-col gap-2">
        <div className="flex justify-between">
          <dt>{t('summary.subtotal')}</dt>
          <dd className="tabular-nums">{money(subtotalVnd)}</dd>
        </div>
        {promoDiscountVnd > 0 && promoCode && (
          <div className="text-success flex justify-between font-medium">
            <dt>{t('summary.promo', { code: promoCode })}</dt>
            <dd className="tabular-nums">−{formatVnd(promoDiscountVnd, locale)}</dd>
          </div>
        )}
        <div className="border-base-300 flex items-baseline justify-between border-t pt-2">
          <dt className="font-semibold">{t('summary.total')}</dt>
          <dd className="text-2xl font-extrabold tabular-nums">{money(totalVnd)}</dd>
        </div>
      </dl>
      {showPoints && (
        <p className="text-primary mt-2 flex items-center gap-2 text-sm">
          <Sparkles aria-hidden size={16} />
          {pointsEarnable === null || pointsEarnable === undefined
            ? t('summary.earnLater')
            : t('summary.earn', { count: pointsEarnable })}
        </p>
      )}
    </div>
  );
}
