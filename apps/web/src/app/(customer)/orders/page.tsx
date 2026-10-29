import Link from 'next/link';
import { ordersControllerListMyOrders, type OrderResponseDto } from '@brewlite/api-client';
import { DEFAULT_PAGE_SIZE } from '@brewlite/contracts';
import { EmptyState } from '@/components/vellum/EmptyState';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { formatDateTime, formatVnd, localized } from '@/i18n/format';
import { getLocale } from '@/i18n/locale.server';
import { readPage } from '@/lib/api-server';
import { orderStatusUi } from '@/lib/order-status';
import { parseCursorParam } from '@/lib/pagination';
import { requireUser } from '@/lib/session';

interface OrdersPageProps {
  searchParams: Promise<{ cursor?: string | string[] }>;
}

function summarise(order: OrderResponseDto, locale: 'vi' | 'en'): string {
  const shown = order.lines.slice(0, 3).map((line) => {
    const name = localized(line.productName, locale);
    return `${name} ${line.size}`;
  });
  if (shown.length === 0) return locale === 'vi' ? 'Đơn không có món' : 'No items';
  return shown.join(', ') + (order.lines.length > shown.length ? '…' : '');
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const [, locale, query] = await Promise.all([requireUser('/orders'), getLocale(), searchParams]);
  const isVi = locale === 'vi';
  const cursor = parseCursorParam(query.cursor);

  let orders: OrderResponseDto[] = [];
  let nextCursor: string | null = null;
  let failed = false;
  try {
    const response = await ordersControllerListMyOrders({
      limit: DEFAULT_PAGE_SIZE,
      ...(cursor ? { cursor } : {}),
    });
    const page = readPage<OrderResponseDto>(response.data);
    orders = page.rows;
    nextCursor = page.nextCursor;
  } catch {
    failed = true;
  }

  return (
    <>
      <PageHead
        title={isVi ? 'Đơn hàng' : 'Orders'}
        meta={
          isVi
            ? `${orders.length} đơn ${cursor ? 'cũ hơn' : 'gần nhất'}`
            : `${orders.length} ${cursor ? 'older' : 'most recent'} ${
                orders.length === 1 ? 'order' : 'orders'
              }`
        }
        lede={
          isVi
            ? 'Đơn đang pha và đơn chờ nhận nằm trên cùng. Đơn chưa thanh toán có thể thử lại từ trang chi tiết.'
            : 'Orders being made and orders ready for pickup appear first. An unpaid order can be retried from its detail page.'
        }
        actions={
          <Link className="btn" href="/">
            {isVi ? 'Đặt món mới' : 'Order again'}
          </Link>
        }
      />

      {failed && (
        <div style={{ marginBottom: 'var(--space-md)' }}>
          <Notice tone="error" role="alert">
            {isVi
              ? 'Không thể tải lịch sử đơn hàng. Vui lòng tải lại trang.'
              : 'Order history could not be loaded. Please reload the page.'}
          </Notice>
        </div>
      )}

      {!failed && orders.length === 0 && (
        <EmptyState
          title={
            cursor
              ? isVi
                ? 'Không còn đơn cũ hơn'
                : 'No older orders'
              : isVi
                ? 'Bạn chưa có đơn hàng nào'
                : "You don't have any orders yet"
          }
          action={
            cursor ? (
              <Link className="btn btn--primary" href="/orders">
                {isVi ? 'Về đơn mới nhất' : 'Back to newest'}
              </Link>
            ) : (
              <Link className="btn btn--primary" href="/">
                {isVi ? 'Đặt món ngay' : 'Order now'}
              </Link>
            )
          }
        >
          {cursor
            ? isVi
              ? 'Bạn đã xem hết lịch sử đơn hàng.'
              : 'You have reached the end of your order history.'
            : isVi
              ? 'Đơn đầu tiên sẽ xuất hiện ở đây sau khi bạn đặt món.'
              : 'Your first order will appear here once you place one.'}
        </EmptyState>
      )}

      {!failed && orders.length > 0 && (
        <div className="orders-layout">
          <div className="panel" style={{ padding: '0 var(--space-md)' }}>
            {orders.map((order) => {
              const ui = orderStatusUi(order.status);
              return (
                <Link className="order-row" href={`/orders/${order.id}`} key={order.id}>
                  <span className="order-code">#{order.orderNo}</span>
                  <span className="order-summary">
                    <p>{summarise(order, locale)}</p>
                    <span className="order-date">{formatDateTime(order.createdAt, locale)}</span>
                  </span>
                  <span className={`tag ${ui.tag}`}>{isVi ? ui.vi : ui.en}</span>
                  <span className="money">{formatVnd(order.totalVnd, locale)}</span>
                </Link>
              );
            })}
          </div>

          <aside className="panel account-panel">
            <h2>{isVi ? 'Trạng thái đơn' : 'Order status'}</h2>
            <dl className="account-list">
              <div className="account-row">
                <dt>{isVi ? 'Chờ pha' : 'To make'}</dt>
                <dd>{isVi ? 'Đã thanh toán, chưa bắt đầu' : 'Paid, not started yet'}</dd>
              </div>
              <div className="account-row">
                <dt>{isVi ? 'Đang pha' : 'Making'}</dt>
                <dd>{isVi ? 'Quầy đang chuẩn bị món' : 'The counter is preparing your items'}</dd>
              </div>
              <div className="account-row">
                <dt>{isVi ? 'Chờ nhận' : 'Ready'}</dt>
                <dd>{isVi ? 'Món đã sẵn sàng tại quầy' : 'Your items are ready at the counter'}</dd>
              </div>
              <div className="account-row">
                <dt>{isVi ? 'Hoàn tất' : 'Completed'}</dt>
                <dd>{isVi ? 'Khách đã nhận món' : 'The customer picked the order up'}</dd>
              </div>
            </dl>
            <p className="fine">
              {isVi
                ? 'Đơn chờ thanh toán có thể thử lại từ trang chi tiết. Trạng thái lạ sẽ hiện nguyên mã để dễ đối chiếu.'
                : 'An unpaid order can be retried from its detail page. An unknown status shows its raw code.'}
            </p>
          </aside>
        </div>
      )}

      {!failed && orders.length > 0 && (cursor || nextCursor) && (
        <nav
          className="pagination"
          aria-label={isVi ? 'Phân trang đơn hàng' : 'Order history pagination'}
        >
          <span>
            {isVi
              ? `${orders.length} đơn ${cursor ? 'cũ hơn' : 'gần nhất'}`
              : `${orders.length} ${cursor ? 'older' : 'most recent'} ${
                  orders.length === 1 ? 'order' : 'orders'
                }`}
          </span>
          <span className="pagination-actions">
            {cursor && (
              <Link className="btn btn--sm" href="/orders">
                {isVi ? 'Mới nhất' : 'Newest'}
              </Link>
            )}
            {nextCursor && (
              <Link
                className="btn btn--sm"
                href={`/orders?cursor=${encodeURIComponent(nextCursor)}`}
                rel="next"
              >
                {isVi ? 'Đơn cũ hơn' : 'Older orders'}
              </Link>
            )}
          </span>
        </nav>
      )}
    </>
  );
}
