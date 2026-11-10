'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import type { AdminOrderDetailResponseDto } from '@brewlite/api-client';
import { formatDateTime, formatVnd, localized } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';
import { Alert } from '../Alert';
import { OrderTicket } from '../order/OrderTicket';
import { StatusBadge } from '../order/StatusBadge';

type Order = AdminOrderDetailResponseDto;
const card = 'border-base-300 bg-base-100 rounded-box flex flex-col gap-3 border p-6';
const REFUND_TONE = { PENDING: 'info', REFUNDED: 'success', FAILED: 'error' } as const;

/** Who did it: *Trần Minh Khoa (staff)* linking to the user, or the role alone (and always for payment / system). */
function Actor({ item }: Readonly<{ item: Order['history'][number] }>) {
  const { t } = useTranslation('admin');
  const type = item.actorType;
  if (type === 'PAYMENT' || type === 'SYSTEM') return <>{t(`orders.actor.${type}`)}</>;
  const role = t(`orders.actor.${type}`, { defaultValue: type.toLowerCase() });
  if (!item.actorName) return <>{t(`orders.actorRole.${type}`, { defaultValue: role })}</>;
  const name = item.actorUserId ? (
    <Link href={`/admin/users/${item.actorUserId}`} className="underline">
      {item.actorName}
    </Link>
  ) : (
    item.actorName
  );
  return (
    <>
      {name} ({role})
    </>
  );
}

/**
 * `/admin/orders/[id]` (`105:6100`): two columns, no actions. Left: ticket and status, timeline,
 * payments, refund. Right: customer, items and totals, note, points. Missing peer data (`degraded`)
 * shows as quiet notices where it would be.
 */
export function AdminOrderView({
  order,
  degraded,
}: Readonly<{ order: Order; degraded: { payment: boolean; identity: boolean } }>) {
  const { t, i18n } = useTranslation('admin');
  const locale = i18n.language as Locale;
  const refund = order.refundStatus as keyof typeof REFUND_TONE;
  const reversed =
    order.status === 'CANCELLED' && order.refundStatus !== 'NONE' && order.pointsEarned > 0;
  const payments = order.payments
    ? [...order.payments].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : null;
  const dim = 'text-base-content/70 text-sm';

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/orders" className="min-h-11 text-sm font-medium underline">
        ‹ {t('orders.back')}
      </Link>
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-4">
          <section className={card}>
            <div className="flex flex-wrap items-center gap-4">
              <OrderTicket orderNo={order.orderNo} size="medium" align="start" />
              <div className="flex flex-col gap-1">
                <StatusBadge status={order.status} />
                <span className={dim}>{formatDateTime(order.createdAt, locale)}</span>
              </div>
            </div>
          </section>

          <section className={card} aria-labelledby="tl">
            <div>
              <h2 id="tl" className="text-xl font-semibold">
                {t('orders.timeline')}
              </h2>
              <p className={dim}>{t('orders.timelineHint')}</p>
            </div>
            {degraded.identity && (
              <p className="bg-base-200 rounded-box px-3 py-2 text-sm" role="status">
                {t('orders.degradedNames')}
              </p>
            )}
            <ol>
              {order.history.map((item, index) => (
                <li key={`${item.toStatus}-${item.createdAt}`} className="flex gap-3">
                  <span aria-hidden className="flex w-4 flex-col items-center">
                    <span className="bg-base-300 mt-1.5 size-3 shrink-0 rounded-full" />
                    {index < order.history.length - 1 && (
                      <span className="bg-base-300 my-1 w-0.5 flex-1" />
                    )}
                  </span>
                  <div className="pb-4">
                    <p className="font-semibold">
                      {t(`order.timeline.status.${item.toStatus}`, { ns: 'orders' })}
                    </p>
                    <p className={`${dim} tabular-nums`}>
                      {formatDateTime(item.createdAt, locale)} · <Actor item={item} />
                    </p>
                    {item.toStatus === 'PAYMENT_FAILED' && item.note && (
                      <p className={dim}>{item.note}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className={card} aria-labelledby="pay">
            <div>
              <h2 id="pay" className="text-xl font-semibold">
                {t('orders.payments')}
              </h2>
              <p className={dim}>{t('orders.paymentsHint')}</p>
            </div>
            {payments === null ? (
              <p className="bg-base-200 rounded-box px-3 py-2 text-sm" role="status">
                {t('orders.degradedPayments')}
              </p>
            ) : payments.length === 0 ? (
              <p>{t('orders.noPayments')}</p>
            ) : (
              <ul>
                {payments.map((p) => (
                  <li
                    key={p.id}
                    className="border-base-300 flex flex-wrap items-center justify-between gap-2 border-t py-2 first:border-t-0"
                  >
                    <span>
                      <span className="font-semibold">{t(`orders.payment.${p.status}`)}</span>
                      <span className={`${dim} block`}>
                        {formatDateTime(p.createdAt, locale)} ·{' '}
                        {p.method ?? t('orders.methodUnknown')}
                      </span>
                    </span>
                    <span className="tabular-nums">{formatVnd(p.amountVnd, locale)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {order.status === 'CANCELLED' && order.paidAt && refund in REFUND_TONE && (
            <section className="flex flex-col gap-2" aria-labelledby="rf">
              <h2 id="rf" className="text-xl font-semibold">
                {t('orders.refundTitle')}
              </h2>
              <Alert type={REFUND_TONE[refund]}>
                {t(`orders.refundNote.${refund}`, {
                  amount: formatVnd(order.totalVnd, locale),
                  no: order.orderNo,
                })}
              </Alert>
            </section>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <section className={card} aria-labelledby="cu">
            <h2 id="cu" className="text-xl font-semibold">
              {t('orders.customer')}
            </h2>
            <Link href={`/admin/users/${order.userId}`} className="font-semibold underline">
              {order.customerName ?? t('orders.customerFallback')}
            </Link>
          </section>

          <section className={card} aria-labelledby="it">
            <h2 id="it" className="text-xl font-semibold">
              {t('orders.items')}
            </h2>
            <ul>
              {order.lines.map((l, i) => (
                <li
                  key={`${l.productId}-${i}`}
                  className="border-base-300 flex justify-between gap-3 border-t py-2 first:border-t-0"
                >
                  <span>
                    {l.qty} × {localized(l.productName, locale)} ({l.size})
                    {l.toppings.length > 0 && (
                      <span className={`${dim} block`}>
                        {l.toppings.map((x) => localized(x.name, locale)).join(', ')}
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums">{formatVnd(l.lineTotalVnd, locale)}</span>
                </li>
              ))}
            </ul>
            <dl className="border-base-300 flex flex-col gap-1 border-t pt-3">
              <div className="flex justify-between">
                <dt>{t('orders.subtotal')}</dt>
                <dd className="tabular-nums">{formatVnd(order.subtotalVnd, locale)}</dd>
              </div>
              {order.promoDiscountVnd > 0 && (
                <div className="flex justify-between">
                  <dt>{t('orders.promo', { code: order.promoCode ?? '' })}</dt>
                  <dd className="tabular-nums">−{formatVnd(order.promoDiscountVnd, locale)}</dd>
                </div>
              )}
              {order.pointsDiscountVnd > 0 && (
                <div className="flex justify-between">
                  <dt>{t('orders.points')}</dt>
                  <dd className="tabular-nums">−{formatVnd(order.pointsDiscountVnd, locale)}</dd>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold">
                <dt>{t('orders.total')}</dt>
                <dd className="tabular-nums">{formatVnd(order.totalVnd, locale)}</dd>
              </div>
            </dl>
          </section>

          {order.note && (
            <section className={card}>
              <h2 className="text-xl font-semibold">{t('orders.note')}</h2>
              <p>{order.note}</p>
            </section>
          )}

          {order.pointsEarned > 0 && (
            <p className={dim}>
              {t(reversed ? 'orders.pointsReversed' : 'orders.pointsEarned', {
                count: order.pointsEarned,
              })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
