import Link from 'next/link';
import {
  adminOrdersControllerList,
  type AdminOrderListItemResponseDto,
} from '@brewlite/api-client';
import { isBusinessDay, zUuidV7 } from '@brewlite/contracts';
import { Button } from '@/components/vellum/Button';
import { EmptyState } from '@/components/vellum/EmptyState';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { Pagination } from '@/components/vellum/Pagination';
import { Panel } from '@/components/vellum/Panel';
import { consoleCopy } from '@/i18n/console';
import { formatDateTime, formatVnd } from '@/i18n/format';
import { getLocale } from '@/i18n/locale.server';
import { ADMIN_PAGE_SIZE, parsePageParam } from '@/lib/pagination';
import { orderStatusUi } from '@/lib/order-status';

const STATUSES = [
  'PENDING',
  'PAYMENT_FAILED',
  'PAID',
  'PREPARING',
  'READY',
  'COMPLETED',
  'CANCELLED',
] as const;
type Status = (typeof STATUSES)[number];

const SORTS = ['-createdAt', 'createdAt', '-totalVnd', 'totalVnd'] as const;
type Sort = (typeof SORTS)[number];

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function orderItemSummary(order: AdminOrderListItemResponseDto, locale: 'vi' | 'en'): string {
  const qty = order.lines.reduce((sum, line) => sum + line.qty, 0);
  const firstName = order.lines[0]?.productName[locale] || order.lines[0]?.productName.vi;
  if (!firstName) return `${qty}`;
  return `${firstName}${order.lines.length > 1 ? ` +${order.lines.length - 1}` : ''} · ${qty}`;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string | string[];
    status?: string | string[];
    from?: string | string[];
    to?: string | string[];
    orderNo?: string | string[];
    userId?: string | string[];
    sort?: string | string[];
  }>;
}) {
  const locale = await getLocale();
  const { t } = consoleCopy(locale);
  const params = await searchParams;

  let pageNumber = parsePageParam(params.page);
  const rawStatus = first(params.status).toUpperCase();
  const status = (STATUSES as readonly string[]).includes(rawStatus)
    ? (rawStatus as Status)
    : undefined;
  const rawFrom = first(params.from).trim();
  const rawTo = first(params.to).trim();
  const from = isBusinessDay(rawFrom) ? rawFrom : '';
  const to = isBusinessDay(rawTo) ? rawTo : '';
  const rawOrderNo = first(params.orderNo).trim();
  const orderNo = /^[1-9]\d{0,17}$/.test(rawOrderNo) ? Number(rawOrderNo) : undefined;
  const rawUserId = first(params.userId).trim();
  const userId = rawUserId && zUuidV7.safeParse(rawUserId).success ? rawUserId : undefined;
  const userIdInvalid = rawUserId.length > 0 && userId === undefined;
  const rawSort = first(params.sort);
  const sort = (SORTS as readonly string[]).includes(rawSort) ? (rawSort as Sort) : '-createdAt';

  let rows: AdminOrderListItemResponseDto[] = [];
  let total: number | null = null;
  let failed = false;
  let degradedIdentity = false;

  if (!userIdInvalid) {
    try {
      const load = (page: number) =>
        adminOrdersControllerList({
          page,
          pageSize: ADMIN_PAGE_SIZE,
          sort,
          ...(status && { status }),
          ...(from && { from }),
          ...(to && { to }),
          ...(orderNo !== undefined && { orderNo }),
          ...(userId && { userId }),
        });

      let response = await load(pageNumber);
      let body = response.data as {
        data?: AdminOrderListItemResponseDto[];
        meta?: { total?: number; degraded?: string[] };
      };
      const totalPages = Math.max(
        1,
        Math.ceil((body.meta?.total ?? body.data?.length ?? 0) / ADMIN_PAGE_SIZE),
      );
      if (pageNumber > totalPages) {
        pageNumber = totalPages;
        response = await load(pageNumber);
        body = response.data as {
          data?: AdminOrderListItemResponseDto[];
          meta?: { total?: number; degraded?: string[] };
        };
      }
      rows = Array.isArray(body.data) ? body.data : [];
      total = typeof body.meta?.total === 'number' ? body.meta.total : null;
      degradedIdentity = Array.isArray(body.meta?.degraded)
        ? body.meta.degraded.includes('identity')
        : false;
    } catch {
      failed = true;
    }
  }

  const query = new URLSearchParams({
    ...(status && { status }),
    ...(from && { from }),
    ...(to && { to }),
    ...(orderNo !== undefined && { orderNo: String(orderNo) }),
    ...(userId && { userId }),
    ...(sort !== '-createdAt' && { sort }),
  }).toString();

  return (
    <>
      <PageHead
        title={t('Đơn hàng', 'Orders')}
        meta={t(`${total ?? rows.length} đơn toàn hệ thống`, `${total ?? rows.length} orders`)}
        lede={t(
          'Tra cứu đơn theo mã, trạng thái và ngày. Mở một đơn để xem món, thanh toán và lịch sử trạng thái.',
          'Look up orders by number, status and date. Open one to see items, payments and status history.',
        )}
      />

      <Panel>
        <form className="toolbar" action="/admin/orders" method="get">
          <div className="field">
            <label htmlFor="order-no">{t('Mã đơn', 'Order no.')}</label>
            <input
              id="order-no"
              className="input"
              name="orderNo"
              inputMode="numeric"
              defaultValue={rawOrderNo}
              placeholder="1042"
            />
          </div>
          <div className="field">
            <label htmlFor="order-user">{t('ID khách', 'Customer ID')}</label>
            <input
              id="order-user"
              className="input"
              name="userId"
              defaultValue={rawUserId}
              placeholder="0190…"
              spellCheck={false}
            />
          </div>
          <div className="field">
            <label htmlFor="order-status">{t('Trạng thái', 'Status')}</label>
            <select id="order-status" className="input" name="status" defaultValue={status ?? ''}>
              <option value="">{t('Tất cả', 'All')}</option>
              {STATUSES.map((value) => {
                const ui = orderStatusUi(value);
                return (
                  <option key={value} value={value}>
                    {locale === 'vi' ? ui.vi : ui.en}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="field">
            <label htmlFor="order-from">{t('Từ ngày', 'From')}</label>
            <input id="order-from" className="input" name="from" type="date" defaultValue={from} />
          </div>
          <div className="field">
            <label htmlFor="order-to">{t('Đến ngày', 'To')}</label>
            <input id="order-to" className="input" name="to" type="date" defaultValue={to} />
          </div>
          <div className="field">
            <label htmlFor="order-sort">{t('Sắp xếp', 'Sort')}</label>
            <select id="order-sort" className="input" name="sort" defaultValue={sort}>
              <option value="-createdAt">{t('Mới nhất', 'Newest first')}</option>
              <option value="createdAt">{t('Cũ nhất', 'Oldest first')}</option>
              <option value="-totalVnd">{t('Giá trị cao', 'Highest value')}</option>
              <option value="totalVnd">{t('Giá trị thấp', 'Lowest value')}</option>
            </select>
          </div>
          <Button type="submit">{t('Lọc', 'Filter')}</Button>
          {(status ||
            from ||
            to ||
            orderNo !== undefined ||
            userId !== undefined ||
            sort !== '-createdAt') && (
            <a className="btn btn--quiet btn--sm" href="/admin/orders">
              {t('Xóa lọc', 'Clear filter')}
            </a>
          )}
        </form>

        {userIdInvalid ? (
          <div className="panel-body">
            <Notice tone="warning" role="alert">
              {t(
                'ID khách không hợp lệ. Dán đúng UUID từ trang người dùng hoặc xóa bộ lọc này.',
                'That customer ID is not valid. Paste the UUID from the user page or clear this filter.',
              )}
            </Notice>
          </div>
        ) : failed ? (
          <div className="panel-body">
            <Notice tone="error" role="alert">
              {t(
                'Không tải được danh sách đơn. Kiểm tra kết nối rồi thử lại.',
                'Could not load orders. Check the connection and try again.',
              )}
            </Notice>
          </div>
        ) : rows.length === 0 ? (
          <div className="panel-body">
            <EmptyState
              title={t('Không có đơn phù hợp', 'No matching orders')}
              action={
                <a className="btn btn--sm" href="/admin/orders">
                  {t('Xóa lọc', 'Clear filter')}
                </a>
              }
            >
              {t(
                'Thử mã đơn khác, đổi trạng thái hoặc mở rộng khoảng ngày.',
                'Try another order number, change the status or widen the date range.',
              )}
            </EmptyState>
          </div>
        ) : (
          <>
            {degradedIdentity && (
              <div className="panel-body" style={{ paddingBottom: 0 }}>
                <Notice tone="warning">
                  {t(
                    'Không đọc được tên khách từ dịch vụ tài khoản; cột Khách đang hiển thị ID.',
                    'Customer names could not be read from the account service; the Customer column shows IDs.',
                  )}
                </Notice>
              </div>
            )}
            <div className="table-wrap">
              <table className="table table--stack table--ledger">
                <thead>
                  <tr>
                    <th>{t('Mã đơn', 'Order')}</th>
                    <th>{t('Thời gian', 'Time')}</th>
                    <th>{t('Khách', 'Customer')}</th>
                    <th>{t('Món', 'Items')}</th>
                    <th className="num">{t('Tổng', 'Total')}</th>
                    <th>{t('Trạng thái', 'Status')}</th>
                    <th className="cell-actions">{t('Thao tác', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((order) => {
                    const ui = orderStatusUi(order.status);
                    return (
                      <tr key={order.id}>
                        <td data-label={t('Mã đơn', 'Order')}>
                          <Link className="cell-title text-link" href={`/admin/orders/${order.id}`}>
                            #{order.orderNo}
                          </Link>
                        </td>
                        <td data-label={t('Thời gian', 'Time')}>
                          {formatDateTime(order.createdAt, locale)}
                        </td>
                        <td data-label={t('Khách', 'Customer')}>
                          <Link
                            className="text-link"
                            href={`/admin/users/${order.userId}`}
                            title={order.userId}
                          >
                            {order.customerName ?? `${order.userId.slice(0, 8)}…`}
                          </Link>
                          {!order.customerName && (
                            <span className="cell-meta">
                              {t('Chưa đọc được tên', 'Name unavailable')}
                            </span>
                          )}
                        </td>
                        <td data-label={t('Món', 'Items')}>{orderItemSummary(order, locale)}</td>
                        <td data-label={t('Tổng', 'Total')} className="num">
                          {formatVnd(order.totalVnd, locale)}
                        </td>
                        <td data-label={t('Trạng thái', 'Status')}>
                          <span className={`tag ${ui.tag}`}>{locale === 'vi' ? ui.vi : ui.en}</span>
                        </td>
                        <td className="cell-actions" data-label={t('Thao tác', 'Actions')}>
                          <Link className="text-link" href={`/admin/orders/${order.id}`}>
                            {t('Chi tiết', 'Details')}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!userIdInvalid && (total ?? rows.length) > 0 && (
          <Pagination
            basePath="/admin/orders"
            page={pageNumber}
            pageSize={ADMIN_PAGE_SIZE}
            total={total ?? rows.length}
            label={t('đơn', 'orders')}
            query={query}
          />
        )}
      </Panel>
    </>
  );
}
