import Link from 'next/link';
import { getT } from '@/i18n/server';

const STATUSES = [
  'PENDING',
  'PAYMENT_FAILED',
  'PAID',
  'PREPARING',
  'READY',
  'COMPLETED',
  'CANCELLED',
] as const;

/**
 * The orders filters (`105:5029`) as a plain GET form: order # (exact), status, the date range,
 * *Apply* and *Clear*. Everything lands in the address, so a reload or a shared link keeps it.
 */
export async function OrdersFilters({
  values,
  userId,
}: Readonly<{
  values: { orderNo: string; status: string; from: string; to: string };
  userId?: string;
}>) {
  const { t } = await getT('admin');
  const { t: o } = await getT('orders');
  return (
    <form method="get" action="/admin/orders" className="flex flex-wrap items-end gap-3">
      {userId && <input type="hidden" name="userId" value={userId} />}
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t('orders.orderNo')}</span>
        <input
          name="orderNo"
          inputMode="numeric"
          defaultValue={values.orderNo}
          className="input w-40 rounded-full"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t('orders.cols.status')}</span>
        <select name="status" defaultValue={values.status} className="select rounded-full">
          <option value="">{t('orders.statusAny')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {o(`status.${s}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t('orders.from')}</span>
        <input type="date" name="from" defaultValue={values.from} className="input" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t('orders.to')}</span>
        <input type="date" name="to" defaultValue={values.to} className="input" />
      </label>
      <button type="submit" className="btn btn-outline min-h-11">
        {t('sales.apply')}
      </button>
      <Link
        href={userId ? `/admin/orders?userId=${userId}` : '/admin/orders'}
        className="min-h-11 content-center text-sm font-medium underline"
      >
        {t('list.clear')}
      </Link>
    </form>
  );
}
