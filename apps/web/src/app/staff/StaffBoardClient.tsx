'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { OrderResponseDto } from '@brewlite/api-client';
import { useToast } from '@/components/feedback/ToastProvider';
import { Button } from '@/components/vellum/Button';
import { EmptyState } from '@/components/vellum/EmptyState';
import { Modal } from '@/components/vellum/Modal';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { Tag } from '@/components/vellum/Tag';
import { useConsoleCopy } from '@/i18n/console-context';
import { formatDateTime, formatVnd, localized } from '@/i18n/format';
import type { Locale } from '@/i18n/locale';
import { runAction, type ActionResult } from '@/lib/action-result';
import { describeError } from '@/lib/error-messages';
import type { ApiErrorDetails } from '@/lib/gateway-types';
import { advanceStaffOrderAction, cancelPaidOrderAction } from '@/lib/staff-actions';

const CANCEL_NOTE_MAX = 200;

type ColumnStatus = 'PAID' | 'PREPARING' | 'READY';
type AdvanceTarget = 'PREPARING' | 'READY' | 'COMPLETED';

const NEXT_TARGET: Record<ColumnStatus, AdvanceTarget> = {
  PAID: 'PREPARING',
  PREPARING: 'READY',
  READY: 'COMPLETED',
};

function errorMessage(
  result: Extract<ActionResult<unknown>, { ok: false }>,
  locale: Locale,
): string {
  return describeError(result.code, result.details as ApiErrorDetails, locale);
}

export default function StaffBoardClient({
  orders: initialOrders,
  failed,
  lastUpdated,
  canUpdate,
  canCancel,
}: {
  orders: OrderResponseDto[];
  failed: boolean;
  lastUpdated: string;
  canUpdate: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const { t, locale } = useConsoleCopy();
  const { showToast } = useToast();
  const [orders, setOrders] = useState(initialOrders);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<{ orderId: string; message: string } | null>(null);
  const [streamState, setStreamState] = useState<'connecting' | 'live' | 'polling'>('connecting');
  const [cancelOrder, setCancelOrder] = useState<OrderResponseDto | null>(null);
  const [cancelNote, setCancelNote] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const markBusy = (orderId: string, busy: boolean) => {
    setBusyIds((current) => {
      const next = new Set(current);
      if (busy) next.add(orderId);
      else next.delete(orderId);
      return next;
    });
  };

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  useEffect(() => {
    let pollTimer: number | null = null;
    const startPolling = () => {
      if (pollTimer !== null) return;
      pollTimer = window.setInterval(() => router.refresh(), 10_000);
    };
    const stopPolling = () => {
      if (pollTimer === null) return;
      window.clearInterval(pollTimer);
      pollTimer = null;
    };

    // A stream that is blocked by a proxy or an expired session must not leave the
    // board frozen: poll the server component until the stream opens again.
    if (typeof EventSource === 'undefined') {
      setStreamState('polling');
      startPolling();
      return stopPolling;
    }

    const source = new EventSource('/api/events/staff');
    const refresh = () => router.refresh();

    source.onopen = () => {
      stopPolling();
      setStreamState('live');
      // A reconnect may have missed frames; the event is a nudge, not the record.
      refresh();
    };
    source.addEventListener('order.status', refresh);
    source.onerror = () => {
      setStreamState('polling');
      startPolling();
    };

    return () => {
      source.removeEventListener('order.status', refresh);
      source.close();
      stopPolling();
    };
  }, [router]);

  useEffect(() => {
    if (!cancelOrder) return;
    setCancelNote('');
    setCancelError('');
  }, [cancelOrder]);

  useEffect(() => {
    if (!cancelOrder) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !cancelBusy) setCancelOrder(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cancelOrder, cancelBusy]);

  const columns: { status: ColumnStatus; title: string; hint: string }[] = [
    {
      status: 'PAID',
      title: t('Chờ pha', 'Waiting'),
      hint: t('Đã thanh toán, chưa bắt đầu', 'Paid, not started yet'),
    },
    {
      status: 'PREPARING',
      title: t('Đang pha', 'Brewing'),
      hint: t('Đang chuẩn bị tại quầy', 'Being prepared at the counter'),
    },
    {
      status: 'READY',
      title: t('Chờ nhận', 'Ready'),
      hint: t('Sẵn sàng gọi khách', 'Ready for pickup'),
    },
  ];

  const nextLabel = (status: ColumnStatus) =>
    status === 'PAID'
      ? t('Bắt đầu pha', 'Start brewing')
      : status === 'PREPARING'
        ? t('Báo sẵn sàng', 'Mark ready')
        : t('Hoàn tất', 'Complete');

  const advance = async (order: OrderResponseDto) => {
    const target = NEXT_TARGET[order.status as ColumnStatus];
    if (!target) return;

    markBusy(order.id, true);
    setError(null);
    try {
      const result = await runAction(advanceStaffOrderAction({ orderId: order.id, to: target }));

      if (!result.ok) {
        setError({ orderId: order.id, message: errorMessage(result, locale) });
        if (result.code === 'INVALID_STATE') router.refresh();
        return;
      }

      setOrders((current) =>
        current
          .map((row) => (row.id === result.data.id ? result.data : row))
          .filter((row) => row.status !== 'COMPLETED'),
      );
      showToast(
        target === 'COMPLETED'
          ? t(`Đơn #${order.orderNo} đã hoàn tất.`, `Order #${order.orderNo} completed.`)
          : t(`Đã cập nhật đơn #${order.orderNo}.`, `Order #${order.orderNo} updated.`),
      );
      router.refresh();
    } finally {
      markBusy(order.id, false);
    }
  };

  const cancel = async () => {
    if (!cancelOrder) return;
    const note = cancelNote.trim();
    if (!note) {
      setCancelError(t('Nhập lý do hủy đơn.', 'Enter a reason for cancelling the order.'));
      return;
    }

    setCancelBusy(true);
    setCancelError('');
    try {
      const result = await runAction(cancelPaidOrderAction({ orderId: cancelOrder.id, note }));

      if (!result.ok) {
        setCancelError(errorMessage(result, locale));
        if (result.code === 'INVALID_STATE') router.refresh();
        return;
      }

      const orderNo = cancelOrder.orderNo;
      setOrders((current) => current.filter((row) => row.id !== result.data.id));
      setCancelOrder(null);
      showToast(t(`Đã hủy đơn #${orderNo}.`, `Order #${orderNo} cancelled.`), { tone: 'info' });
      router.refresh();
    } finally {
      setCancelBusy(false);
    }
  };

  const columnsWithOrders = columns.map((column) => ({
    ...column,
    orders: orders.filter((order) => order.status === column.status),
  }));
  const total = columnsWithOrders.reduce((sum, column) => sum + column.orders.length, 0);

  if (failed) {
    return (
      <div>
        <PageHead
          title={t('Bảng đơn', 'Order board')}
          meta={t(
            `Cập nhật ${formatDateTime(lastUpdated, locale)}`,
            `Updated ${formatDateTime(lastUpdated, locale)}`,
          )}
          lede={t(
            'Đơn đã thanh toán sẽ xuất hiện ở đây khi khách đặt món.',
            'Paid orders appear here as soon as a customer places one.',
          )}
        />
        <EmptyState title={t('Không tải được bảng đơn', 'Could not load the order board')}>
          {t(
            'Chưa kết nối được hệ thống đơn hàng. Thử làm mới sau ít phút.',
            'The order service is not reachable. Try refreshing in a moment.',
          )}
        </EmptyState>
      </div>
    );
  }

  return (
    <div>
      <PageHead
        title={t('Bảng đơn', 'Order board')}
        meta={t(
          `Cập nhật ${formatDateTime(lastUpdated, locale)} · ${total} đơn trên bảng`,
          `Updated ${formatDateTime(lastUpdated, locale)} · ${total} orders on the board`,
        )}
        lede={t(
          'Ba cột đúng ba trạng thái bếp. Đơn hoàn tất hoặc đã hủy tự rời bảng.',
          'Three columns for the three kitchen states. Completed or cancelled orders leave the board automatically.',
        )}
        actions={
          <>
            <Tag tone={streamState === 'live' ? 'success' : 'muted'}>
              {streamState === 'live'
                ? t('Trực tiếp', 'Live')
                : streamState === 'polling'
                  ? t('Tự làm mới', 'Auto-refresh')
                  : t('Đang kết nối', 'Connecting')}
            </Tag>
            <Button size="sm" onClick={() => router.refresh()}>
              {t('Làm mới', 'Refresh')}
            </Button>
          </>
        }
      />

      {total === 0 ? (
        <EmptyState title={t('Chưa có đơn trên bảng', 'No orders on the board')}>
          {t(
            'Đơn đã thanh toán sẽ xuất hiện ở đây khi khách đặt món.',
            'Paid orders appear here as soon as a customer places one.',
          )}
        </EmptyState>
      ) : (
        <div className="board">
          {columnsWithOrders.map((column) => (
            <section
              className="board-column"
              key={column.status}
              aria-labelledby={`col-${column.status}`}
            >
              <div className="board-col-head">
                <h2 id={`col-${column.status}`}>{column.title}</h2>
                <span className="board-count">
                  {t(`${column.orders.length} đơn`, `${column.orders.length} orders`)}
                </span>
              </div>
              <p
                className="muted"
                style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-2xs)' }}
              >
                {column.hint}
              </p>

              {column.orders.length === 0 ? (
                <div className="board-empty">
                  <h3>{t('Không có đơn', 'No orders')}</h3>
                  <p>{t('Cột này trống.', 'This column is empty.')}</p>
                </div>
              ) : (
                column.orders.map((order) => {
                  const busy = busyIds.has(order.id);
                  const rowError = error?.orderId === order.id ? error.message : null;
                  const status = order.status as ColumnStatus;

                  return (
                    <article className="docket" key={order.id} aria-busy={busy}>
                      <div className="docket-head">
                        <span className="docket-no">#{order.orderNo}</span>
                        <span className="docket-time">
                          {formatDateTime(order.createdAt, locale).split(' ')[0]}
                        </span>
                      </div>

                      <div className="docket-lines">
                        {order.lines.map((line, index) => (
                          <div className="docket-line" key={`${order.id}-${index}`}>
                            <span className="docket-qty">{line.qty}×</span>
                            <span className="docket-name">
                              {localized(line.productName, locale)}
                              <span className="docket-options">
                                Size {line.size}
                                {line.toppings.length > 0
                                  ? `, ${line.toppings
                                      .map((topping) => localized(topping.name, locale))
                                      .join(', ')}`
                                  : ''}
                              </span>
                            </span>
                            <span className="docket-price">
                              {formatVnd(line.lineTotalVnd, locale)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {order.note && (
                        <p className="docket-options" style={{ whiteSpace: 'pre-wrap' }}>
                          {t('Ghi chú:', 'Note:')} {order.note}
                        </p>
                      )}

                      <div className="docket-total">
                        <span>{t('Tổng', 'Total')}</span>
                        <span>{formatVnd(order.totalVnd, locale)}</span>
                      </div>

                      {rowError && (
                        <Notice tone="error" role="alert">
                          {rowError}
                        </Notice>
                      )}

                      {canUpdate && (
                        <div className="docket-actions">
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={busy}
                            onClick={() => advance(order)}
                          >
                            {busy ? t('Đang lưu…', 'Saving…') : nextLabel(status)}
                          </Button>
                          {status === 'PAID' && canCancel && (
                            <button
                              type="button"
                              className="docket-secondary"
                              disabled={busy}
                              onClick={() => setCancelOrder(order)}
                            >
                              {t('Hủy đơn', 'Cancel order')}
                            </button>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </section>
          ))}
        </div>
      )}

      {cancelOrder && (
        <Modal
          title={t(`Hủy đơn #${cancelOrder.orderNo}`, `Cancel order #${cancelOrder.orderNo}`)}
          meta={t('Thao tác không hoàn tác được', 'This cannot be undone')}
          onClose={() => {
            if (!cancelBusy) setCancelOrder(null);
          }}
          closeLabel={t('Đóng', 'Close')}
          initialFocusRef={noteRef}
          footer={
            <>
              <Button variant="quiet" disabled={cancelBusy} onClick={() => setCancelOrder(null)}>
                {t('Giữ đơn', 'Keep order')}
              </Button>
              <Button
                variant="danger-fill"
                disabled={cancelBusy || cancelNote.trim().length === 0}
                onClick={cancel}
              >
                {cancelBusy ? t('Đang hủy…', 'Cancelling…') : t('Hủy đơn', 'Cancel order')}
              </Button>
            </>
          }
        >
          <div className="modal-order">
            <span>{t('Đơn đã thanh toán', 'Paid order')}</span>
            <strong>{formatVnd(cancelOrder.totalVnd, locale)}</strong>
          </div>

          <Notice tone="warning">
            {t('Đơn sẽ chuyển sang ', 'The order moves to ')}
            <strong>CANCELLED</strong>
            {t(
              ' và biến mất khỏi bảng bếp. Lý do được lưu cùng đơn để đối soát.',
              ' and leaves the kitchen board. The reason is stored with the order for reconciliation.',
            )}
          </Notice>

          <div className="field">
            <label htmlFor="cancel-note">
              {t('Lý do hủy', 'Cancellation reason')}{' '}
              <span className="muted">{t('(bắt buộc)', '(required)')}</span>
            </label>
            <textarea
              id="cancel-note"
              ref={noteRef}
              className="input"
              maxLength={CANCEL_NOTE_MAX}
              rows={3}
              value={cancelNote}
              placeholder={t(
                'Ví dụ: khách gọi báo đổi món',
                'e.g. customer called to change the order',
              )}
              disabled={cancelBusy}
              onChange={(event) => setCancelNote(event.target.value)}
            />
            <p className="field-hint">
              {t(
                `${cancelNote.trim().length}/${CANCEL_NOTE_MAX} ký tự. Chưa nhập lý do thì không thể hủy.`,
                `${cancelNote.trim().length}/${CANCEL_NOTE_MAX} characters. A reason is required to cancel.`,
              )}
            </p>
          </div>

          {cancelError && (
            <Notice tone="error" role="alert">
              {cancelError}
            </Notice>
          )}
        </Modal>
      )}
    </div>
  );
}
