'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import type { OrderResponseDto } from '@brewlite/api-client';
import { loadMoreOrders } from '@/actions/orders';
import type { Locale } from '@/i18n/settings';
import { Alert } from '../Alert';
import { OrderRow } from './OrderRow';

/** The first page comes from the server; *Load more* appends the next twenty by cursor. */
export function OrderList({
  initial,
  nextCursor,
}: Readonly<{ initial: OrderResponseDto[]; nextCursor: string | null }>) {
  const { t, i18n } = useTranslation('orders');
  const locale = i18n.language as Locale;
  const [orders, setOrders] = useState(initial);
  const [cursor, setCursor] = useState(nextCursor);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  if (orders.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-12 text-center">
        <p className="text-lg">{t('empty.title')}</p>
        <Link href="/" className="btn btn-primary">
          {t('empty.action')}
        </Link>
      </div>
    );
  }

  const more = () =>
    startTransition(async () => {
      if (!cursor) return;
      setFailed(false);
      const result = await loadMoreOrders(cursor);
      if (!result.ok) return setFailed(true);
      setOrders((current) => [
        ...current,
        ...result.data.orders.filter((o) => !current.some((c) => c.id === o.id)),
      ]);
      setCursor(result.data.nextCursor);
    });

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {orders.map((order) => (
          <OrderRow
            key={order.id}
            order={order}
            locale={locale}
            label={t('row.label', { no: order.orderNo })}
          />
        ))}
      </ul>
      {failed && <Alert type="error">{t('loadMoreFailed')}</Alert>}
      {cursor && (
        <button type="button" className="btn btn-outline" disabled={pending} onClick={more}>
          {t('loadMore')}
        </button>
      )}
    </div>
  );
}
