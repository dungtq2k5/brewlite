'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import type {
  AdminOrderListItemResponseDto,
  LoyaltyResponseDto,
  StaffStatsResponseDto,
} from '@brewlite/api-client';
import { formatDateTime, formatVnd } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';
import { itemsSummary } from '@/lib/admin/order-summary';
import { StatusBadge } from '../order/StatusBadge';

/** A customer's balance, lifetime total and latest movements; each row opens the order in admin. */
export function UserPoints({ loyalty }: Readonly<{ loyalty: LoyaltyResponseDto }>) {
  const { t, i18n } = useTranslation('admin');
  const locale = i18n.language as Locale;
  return (
    <section
      aria-labelledby="points-title"
      className="border-base-300 bg-base-100 rounded-box flex flex-col gap-3 border p-6"
    >
      <h2 id="points-title" className="text-xl font-semibold">
        {t('users.detail.points')}
      </h2>
      <p>
        <span className="text-2xl font-bold">
          {t('users.detail.balance', { count: loyalty.balance })}
        </span>{' '}
        <span className="text-base-content/70 text-sm">
          · {t('users.detail.lifetime')}: {loyalty.lifetimeEarned}
        </span>
      </p>
      {loyalty.recent.length === 0 ? (
        <p>{t('users.detail.noPoints')}</p>
      ) : (
        <ul>
          {loyalty.recent.map((entry) => (
            <li
              key={`${entry.orderId}-${entry.kind}-${entry.at}`}
              className="border-base-300 border-t"
            >
              <Link
                href={`/admin/orders/${entry.orderId}`}
                className="flex min-h-11 items-center justify-between gap-3 py-2"
              >
                <span>
                  {t(`users.detail.ledger.${entry.kind}`, { no: entry.orderNo })}
                  <span className="text-base-content/70 block text-sm">
                    {formatDateTime(entry.at, locale)}
                  </span>
                </span>
                <span
                  className={`font-bold tabular-nums ${entry.points < 0 ? 'text-error' : 'text-success'}`}
                >
                  {entry.points > 0 ? `+${entry.points}` : entry.points}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The latest three orders and a link to all of them. */
export function UserOrders({
  orders,
  userId,
}: Readonly<{ orders: AdminOrderListItemResponseDto[]; userId: string }>) {
  const { t, i18n } = useTranslation('admin');
  const locale = i18n.language as Locale;
  return (
    <section
      aria-labelledby="orders-title"
      className="border-base-300 bg-base-100 rounded-box flex flex-col gap-3 border p-6"
    >
      <h2 id="orders-title" className="text-xl font-semibold">
        {t('users.detail.orders')}
      </h2>
      {orders.length === 0 ? (
        <p>{t('users.detail.noOrders')}</p>
      ) : (
        <ul>
          {orders.map((o) => (
            <li key={o.id} className="border-base-300 border-t first:border-t-0">
              <Link
                href={`/admin/orders/${o.id}`}
                className="flex min-h-11 flex-wrap items-center justify-between gap-3 py-2"
              >
                <span className="min-w-0">
                  <span className="font-semibold">#{o.orderNo}</span>{' '}
                  <span className="text-base-content/70 text-sm">
                    {formatDateTime(o.createdAt, locale)}
                  </span>
                  <span className="text-base-content/70 block max-w-md truncate text-sm">
                    {itemsSummary(o.lines, locale)}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <StatusBadge status={o.status} />
                  <span className="tabular-nums">{formatVnd(o.totalVnd, locale)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href={`/admin/orders?userId=${userId}`} className="min-h-11 font-medium underline">
        {t('users.detail.seeAll')}
      </Link>
    </section>
  );
}

/** What a staff member or admin did at the counter in the chosen range. */
export function CounterTiles({ stats }: Readonly<{ stats: StaffStatsResponseDto }>) {
  const { t } = useTranslation('admin');
  const tiles = [
    ['handled', stats.ordersHandled],
    ['started', stats.transitions.PREPARING],
    ['ready', stats.transitions.READY],
    ['collected', stats.transitions.COMPLETED],
    ['cancelled', stats.transitions.CANCELLED],
  ] as const;
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {tiles.map(([key, value]) => (
        <div key={key} className="bg-base-200 rounded-box px-4 py-3">
          <dt className="text-base-content/70 text-sm">{t(`users.detail.${key}`)}</dt>
          <dd className="text-2xl font-bold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
