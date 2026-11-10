import Link from 'next/link';
import {
  adminOrdersControllerList,
  AdminOrdersControllerListSort,
  AdminOrdersControllerListStatus,
} from '@brewlite/api-client';
import { businessDay, isBusinessDay } from '@brewlite/contracts';
import { AdminTable, Td, Th } from '@/components/admin/AdminTable';
import { DegradedNotice } from '@/components/admin/DegradedNotice';
import { OrderTicket } from '@/components/admin/OrderTicket';
import { OrdersFilters } from '@/components/admin/OrdersFilters';
import { Pagination } from '@/components/admin/Pagination';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { formatDateTime, formatVnd } from '@/i18n/format';
import { getT } from '@/i18n/server';
import {
  ADMIN_PAGE_SIZE,
  firstParam,
  readChoice,
  readOptionalChoice,
  readPage,
  type RawParams,
} from '@/lib/admin/list-params';
import { itemsSummary } from '@/lib/admin/order-summary';
import { withRequestId } from '@/lib/with-request-id';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT('admin');
  return { title: t('orders.title') };
}

const STATUSES = Object.values(AdminOrdersControllerListStatus);
const SORTS = Object.values(AdminOrdersControllerListSort);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `/admin/orders` (`105:5029`): today by default; `?userId=` narrows to one customer. */
export default async function OrdersPage({
  searchParams,
}: Readonly<{ searchParams: Promise<RawParams> }>) {
  const raw = await searchParams;
  const { t, locale } = await getT('admin');
  const page = readPage(raw);
  const status = readOptionalChoice(raw, 'status', STATUSES);
  const sort = readChoice(raw, 'sort', SORTS, '-createdAt');
  const orderNoText = firstParam(raw, 'orderNo').trim();
  const orderNo = /^\d{1,9}$/.test(orderNoText) ? Number(orderNoText) : undefined;
  const userIdText = firstParam(raw, 'userId');
  const userId = UUID.test(userIdText) ? userIdText : undefined;
  const fromText = firstParam(raw, 'from');
  const toText = firstParam(raw, 'to');
  const given = isBusinessDay(fromText) && isBusinessDay(toText) && fromText <= toText;
  const narrowed = Boolean(orderNo || userId);
  // *Today* is the default unless the person already narrowed it another way.
  const today = businessDay(new Date());
  const range = given
    ? { from: fromText, to: toText }
    : narrowed
      ? undefined
      : { from: today, to: today };

  const res = await adminOrdersControllerList({
    page,
    pageSize: ADMIN_PAGE_SIZE,
    sort,
    ...(status ? { status } : {}),
    ...(range ?? {}),
    ...(orderNo ? { orderNo } : {}),
    ...(userId ? { userId } : {}),
  }).catch((error: unknown) => {
    throw withRequestId(error);
  });
  const rows = res.status === 200 ? (res.data.data ?? []) : [];
  const total = res.status === 200 ? (res.data.meta?.total ?? 0) : 0;
  const degraded = res.status === 200 && (res.data.meta?.degraded?.length ?? 0) > 0;
  const current: Record<string, string> = {
    ...(status ? { status } : {}),
    ...(orderNoText ? { orderNo: orderNoText } : {}),
    ...(userId ? { userId } : {}),
    ...(given ? { from: fromText, to: toText } : {}),
    ...(sort === '-createdAt' ? {} : { sort }),
    ...(page > 1 ? { page: String(page) } : {}),
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-3xl font-bold">{t('orders.title')}</h1>
        <p className="text-base-content/80">
          {t('orders.count', { count: total })} · {t('orders.vnTime')}
          {!given && !narrowed && ` · ${t('orders.dateToday')}`}
        </p>
      </div>
      {userId && (
        <p className="bg-secondary rounded-box flex items-center justify-between gap-3 px-4 py-2">
          {t('orders.filterUser')}
          <Link href="/admin/orders" className="min-h-11 content-center font-medium underline">
            {t('orders.clearUser')}
          </Link>
        </p>
      )}
      <OrdersFilters
        values={{
          orderNo: orderNoText,
          status: status ?? '',
          from: range?.from ?? '',
          to: range?.to ?? '',
        }}
        userId={userId}
      />
      {degraded && <DegradedNotice kind="names" />}
      {rows.length === 0 ? (
        <div className="border-base-300 rounded-box border px-4 py-12 text-center">
          <p className="text-lg font-semibold">{t('orders.none')}</p>
          <p>{t('orders.noneHint')}</p>
        </div>
      ) : (
        <>
          <AdminTable caption={t('orders.title')}>
            <thead>
              <tr>
                <Th>{t('orders.cols.order')}</Th>
                <Th>{t('orders.cols.when')}</Th>
                <Th>{t('orders.cols.customer')}</Th>
                <Th>{t('orders.cols.items')}</Th>
                <Th className="text-right">{t('orders.cols.total')}</Th>
                <Th>{t('orders.cols.status')}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <Td>
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="inline-block"
                      aria-label={`#${o.orderNo}`}
                    >
                      <OrderTicket orderNo={o.orderNo} size="small" align="start" />
                    </Link>
                  </Td>
                  <Td className="text-sm whitespace-nowrap">
                    {formatDateTime(o.createdAt, locale)}
                  </Td>

                  <Td>
                    <Link href={`/admin/users/${o.userId}`} className="underline">
                      {o.customerName ?? t('orders.customerFallback')}
                    </Link>
                  </Td>
                  <Td className="max-w-xs truncate text-sm">{itemsSummary(o.lines, locale)}</Td>
                  <Td className="text-right tabular-nums">{formatVnd(o.totalVnd, locale)}</Td>
                  <Td>
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge status={o.status} />
                      {o.refundStatus !== 'NONE' && o.status === 'CANCELLED' && (
                        <span className="text-base-content/70 text-xs font-medium">
                          {t(`orders.refund.${o.refundStatus}`)}
                        </span>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </AdminTable>
          <Pagination
            path="/admin/orders"
            current={current}
            page={page}
            pageSize={ADMIN_PAGE_SIZE}
            total={total}
          />
        </>
      )}
    </div>
  );
}
