import type { LoyaltyResponseDto } from '@brewlite/api-client';
import { LOYALTY_EARN_STEP_VND } from '@brewlite/contracts';
import { formatVnd } from '@/i18n/format';
import { getLocale, getT } from '@/i18n/server';
import { LedgerRow } from './LedgerRow';

/** The balance, lifetime total, the rule and the latest movements — each one links to its order. */
export async function PointsSummary({ loyalty }: Readonly<{ loyalty: LoyaltyResponseDto }>) {
  const [{ t }, locale] = await Promise.all([getT('account'), getLocale()]);
  return (
    <section aria-labelledby="points-title" className="flex flex-col gap-3">
      <h2 id="points-title" className="text-xl font-semibold">
        {t('points.heading', { count: loyalty.balance })}
      </h2>
      <p className="text-base-content/70 text-sm">
        {t('points.lifetime')}: {loyalty.lifetimeEarned} ·{' '}
        {t('points.rule', { step: formatVnd(LOYALTY_EARN_STEP_VND, locale) })}
      </p>
      {loyalty.recent.length === 0 ? (
        <p>{t('points.none')}</p>
      ) : (
        <ul className="border-base-300 rounded-box border px-4">
          {loyalty.recent.map((entry) => (
            <LedgerRow key={`${entry.orderId}-${entry.kind}-${entry.at}`} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  );
}
