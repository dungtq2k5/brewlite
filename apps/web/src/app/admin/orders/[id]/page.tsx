import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ApiClientError,
  adminOrdersControllerGet,
  type AdminOrderDetailResponseDto,
} from '@brewlite/api-client';
import { ButtonLink } from '@/components/vellum/Button';
import { DetailList } from '@/components/vellum/DetailList';
import { EmptyState } from '@/components/vellum/EmptyState';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { Panel, PanelHead } from '@/components/vellum/Panel';
import { consoleCopy } from '@/i18n/console';
import { formatVnd, localized } from '@/i18n/format';
import { getLocale } from '@/i18n/locale.server';
import { formatMoment } from '@/lib/admin-format';
import { unwrap } from '@/lib/api-server';
import { orderStatusUi } from '@/lib/order-status';

const PAYMENT_STATUS: Record<string, { vi: string; en: string }> = {
  PENDING: { vi: 'Chờ thanh toán', en: 'Pending' },
  SUCCEEDED: { vi: 'Thành công', en: 'Succeeded' },
  FAILED: { vi: 'Thất bại', en: 'Failed' },
  EXPIRED: { vi: 'Hết hạn', en: 'Expired' },
};

function actorLabel(actorType: string, isVi: boolean): string {
  if (actorType === 'CUSTOMER') return isVi ? 'Khách' : 'Customer';
  if (actorType === 'STAFF') return isVi ? 'Nhân viên' : 'Staff';
  if (actorType === 'PAYMENT') return isVi ? 'Thanh toán' : 'Payment';
  if (actorType === 'SYSTEM') return isVi ? 'Hệ thống' : 'System';
  return actorType;
}

const REFUND_LABEL: Record<string, { vi: string; en: string }> = {
  NONE: { vi: 'Không', en: 'None' },
  PENDING: { vi: 'Đang hoàn', en: 'Pending' },
  REFUNDED: { vi: 'Đã hoàn', en: 'Refunded' },
  FAILED: { vi: 'Hoàn thất bại', en: 'Failed' },
};

export const dynamic = 'force-dynamic';

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const isVi = locale === 'vi';
  const { t } = consoleCopy(locale);

  let order: AdminOrderDetailResponseDto | null = null;
  let failed = false;
  let identityDegraded = false;
  try {
    const response = await adminOrdersControllerGet(id);
    const body = response.data as {
      data?: AdminOrderDetailResponseDto;
      meta?: { degraded?: string[] };
    };
    order = unwrap<AdminOrderDetailResponseDto>(body);
    identityDegraded = Array.isArray(body.meta?.degraded)
      ? body.meta.degraded.includes('identity')
      : false;
  } catch (error) {
    if (
      error instanceof ApiClientError &&
      (error.status === 400 || error.status === 404 || error.status === 422)
    ) {
      notFound();
    }
    failed = true;
  }

  if (failed || !order) {
    return (
      <>
        <PageHead
          title={t('Chi tiết đơn', 'Order detail')}
          meta={t('Không đọc được dữ liệu', 'Could not load the record')}
          actions={
            <ButtonLink href="/admin/orders" variant="quiet" size="sm">
              ← {t('Danh sách', 'Back to list')}
            </ButtonLink>
          }
        />
        <Notice tone="error" role="alert">
          {t(
            'Không tải được đơn hàng. Kiểm tra kết nối rồi thử lại.',
            'Could not load this order. Check the connection and try again.',
          )}
        </Notice>
      </>
    );
  }

  const status = orderStatusUi(order.status);
  const payments = order.payments;
  const qty = order.lines.reduce((sum, line) => sum + line.qty, 0);

  return (
    <>
      <PageHead
        title={`#${order.orderNo}`}
        meta={`${formatMoment(order.createdAt, locale)} · ${qty} ${isVi ? 'món' : 'items'}`}
        actions={
          <>
            <span className={`tag ${status.tag}`}>{isVi ? status.vi : status.en}</span>
            <ButtonLink href="/admin/orders" variant="quiet" size="sm">
              ← {t('Danh sách', 'Back to list')}
            </ButtonLink>
          </>
        }
      />

      {identityDegraded && (
        <Notice tone="warning">
          {t(
            'Không đọc được tên khách và tên nhân viên từ dịch vụ tài khoản; ID vẫn hiển thị để đối chiếu.',
            'Customer and staff names could not be read from the account service; IDs are still shown for reference.',
          )}
        </Notice>
      )}

      <div className="record-grid">
        <Panel>
          <PanelHead
            title={t('Món trong đơn', 'Order items')}
            action={
              <span className="muted">
                {order.promoCode ? `${t('Mã', 'Code')} ${order.promoCode}` : null}
              </span>
            }
          />
          {order.lines.length === 0 ? (
            <div className="panel-body">
              <EmptyState title={t('Đơn không có món', 'No items on this order')}>
                {t('Đơn này chưa ghi nhận dòng món nào.', 'This order has no recorded items.')}
              </EmptyState>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table table--stack">
                <thead>
                  <tr>
                    <th>{t('Món', 'Item')}</th>
                    <th>{t('Size', 'Size')}</th>
                    <th className="num">{t('SL', 'Qty')}</th>
                    <th className="num">{t('Đơn giá', 'Unit')}</th>
                    <th className="num">{t('Thành tiền', 'Line total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((line, index) => (
                    <tr key={`${line.productId}-${index}`}>
                      <td data-label={t('Món', 'Item')}>
                        <span className="cell-title">{localized(line.productName, locale)}</span>
                        {line.toppings.length > 0 && (
                          <span className="cell-meta">
                            {line.toppings
                              .map(
                                (topping) =>
                                  `${localized(topping.name, locale)} (+${formatVnd(topping.priceVnd, locale)})`,
                              )
                              .join(' · ')}
                          </span>
                        )}
                      </td>
                      <td data-label={t('Size', 'Size')}>{line.size}</td>
                      <td data-label={t('SL', 'Qty')} className="num">
                        {line.qty}
                      </td>
                      <td data-label={t('Đơn giá', 'Unit')} className="num">
                        {formatVnd(line.unitPriceVnd, locale)}
                      </td>
                      <td data-label={t('Thành tiền', 'Line total')} className="num">
                        {formatVnd(line.lineTotalVnd, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="panel-body">
            <DetailList
              rows={[
                {
                  label: t('Tạm tính', 'Subtotal'),
                  value: formatVnd(order.subtotalVnd, locale),
                },
                {
                  label: t('Giảm giá', 'Discount'),
                  value:
                    order.promoDiscountVnd + order.pointsDiscountVnd > 0
                      ? `−${formatVnd(order.promoDiscountVnd + order.pointsDiscountVnd, locale)}`
                      : '—',
                },
                {
                  label: t('Tổng cộng', 'Total'),
                  value: <strong>{formatVnd(order.totalVnd, locale)}</strong>,
                },
              ]}
            />
          </div>
        </Panel>

        <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
          <Panel>
            <PanelHead title={t('Thông tin đơn', 'Order info')} />
            <div className="panel-body">
              <DetailList
                rows={[
                  {
                    label: t('Khách hàng', 'Customer'),
                    value: (
                      <Link className="text-link" href={`/admin/users/${order.userId}`}>
                        {order.customerName ?? order.userId}
                      </Link>
                    ),
                  },
                  { label: t('Trạng thái', 'Status'), value: isVi ? status.vi : status.en },
                  { label: t('Ghi chú', 'Note'), value: order.note ?? '—' },
                  { label: t('Tạo lúc', 'Created'), value: formatMoment(order.createdAt, locale) },
                  { label: t('Thanh toán lúc', 'Paid'), value: formatMoment(order.paidAt, locale) },
                  {
                    label: t('Hủy lúc', 'Cancelled'),
                    value: formatMoment(order.cancelledAt, locale),
                  },
                  {
                    label: t('Lý do hủy', 'Cancel reason'),
                    value: order.cancelReason ?? '—',
                  },
                  {
                    label: t('Hoàn tiền', 'Refund'),
                    value: REFUND_LABEL[order.refundStatus]
                      ? isVi
                        ? REFUND_LABEL[order.refundStatus].vi
                        : REFUND_LABEL[order.refundStatus].en
                      : order.refundStatus || '—',
                  },
                  {
                    label: t('Điểm tích', 'Points earned'),
                    value: String(order.pointsEarned),
                  },
                  {
                    label: 'ID',
                    value: <span className="record-id">{order.id}</span>,
                  },
                ]}
              />
            </div>
          </Panel>

          <Panel>
            <PanelHead title={t('Thanh toán', 'Payments')} />
            <div className="panel-body">
              {payments === null ? (
                <Notice tone="warning">
                  {t(
                    'Không đọc được dịch vụ thanh toán; danh sách giao dịch tạm ẩn.',
                    'The payment service could not be reached; transactions are hidden.',
                  )}
                </Notice>
              ) : payments.length === 0 ? (
                <p className="fine">{t('Chưa có giao dịch.', 'No payments yet.')}</p>
              ) : (
                <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
                  {payments.map((payment) => {
                    const label = PAYMENT_STATUS[payment.status];
                    const method =
                      payment.method && payment.method !== payment.provider ? payment.method : null;
                    return (
                      <div key={payment.id} className="task-row">
                        <span className="task-title">
                          {label ? (isVi ? label.vi : label.en) : payment.status} ·{' '}
                          {formatVnd(payment.amountVnd, locale)}
                        </span>
                        <span className="task-detail">
                          {payment.provider}
                          {method ? ` · ${method}` : ''} · {formatMoment(payment.createdAt, locale)}
                        </span>
                        <span className="record-id">{payment.id}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {order.currentPaymentId && (
                <p className="fine" style={{ marginTop: 'var(--space-sm)' }}>
                  {t('Giao dịch hiện tại', 'Current payment')}:{' '}
                  <span className="record-id">{order.currentPaymentId}</span>
                </p>
              )}
            </div>
          </Panel>
        </div>
      </div>

      <Panel>
        <PanelHead title={t('Lịch sử trạng thái', 'Status history')} />
        {order.history.length === 0 ? (
          <div className="panel-body">
            <p className="fine">{t('Chưa có lịch sử.', 'No history yet.')}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table table--stack">
              <thead>
                <tr>
                  <th>{t('Thời gian', 'Time')}</th>
                  <th>{t('Từ', 'From')}</th>
                  <th>{t('Đến', 'To')}</th>
                  <th>{t('Người thực hiện', 'Actor')}</th>
                  <th>{t('Ghi chú', 'Note')}</th>
                </tr>
              </thead>
              <tbody>
                {order.history.map((entry, index) => (
                  <tr key={`${entry.createdAt}-${index}`}>
                    <td data-label={t('Thời gian', 'Time')}>
                      {formatMoment(entry.createdAt, locale)}
                    </td>
                    <td data-label={t('Từ', 'From')}>
                      {entry.fromStatus
                        ? isVi
                          ? orderStatusUi(entry.fromStatus).vi
                          : orderStatusUi(entry.fromStatus).en
                        : '—'}
                    </td>
                    <td data-label={t('Đến', 'To')}>
                      {isVi ? orderStatusUi(entry.toStatus).vi : orderStatusUi(entry.toStatus).en}
                    </td>
                    <td data-label={t('Người thực hiện', 'Actor')}>
                      {entry.actorName && entry.actorUserId ? (
                        <Link
                          className="text-link"
                          href={`/admin/users/${entry.actorUserId}`}
                          title={entry.actorUserId}
                        >
                          {entry.actorName}
                        </Link>
                      ) : (
                        (entry.actorName ?? actorLabel(entry.actorType, isVi))
                      )}
                      {entry.actorName && (
                        <span className="cell-meta">{actorLabel(entry.actorType, isVi)}</span>
                      )}
                    </td>
                    <td data-label={t('Ghi chú', 'Note')}>{entry.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <p className="fine" style={{ marginTop: 'var(--space-md)' }}>
        <Link className="text-link" href="/staff">
          {t('Mở bảng đơn của quầy', 'Open the counter board')}
        </Link>
      </p>
    </>
  );
}
