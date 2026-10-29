'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { OrderResponseDto } from '@brewlite/api-client';
import { Button } from '@/components/vellum/Button';
import { EmptyState } from '@/components/vellum/EmptyState';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { Tag } from '@/components/vellum/Tag';
import { formatDateTime, formatVnd, localized } from '@/i18n/format';
import type { ActionResult } from '@/lib/action-result';
import { describeError } from '@/lib/error-messages';
import type { ApiErrorDetails } from '@/lib/gateway-types';
import { advanceStaffOrderAction, cancelPaidOrderAction } from '@/lib/staff-actions';

const CANCEL_NOTE_MAX = 200;

type ColumnStatus = 'PAID' | 'PREPARING' | 'READY';
type AdvanceTarget = 'PREPARING' | 'READY' | 'COMPLETED';

const COLUMNS: {
  status: ColumnStatus;
  title: string;
  hint: string;
}[] = [
  { status: 'PAID', title: 'Chờ pha', hint: 'Đã thanh toán, chưa bắt đầu' },
  { status: 'PREPARING', title: 'Đang pha', hint: 'Đang chuẩn bị tại quầy' },
  { status: 'READY', title: 'Chờ nhận', hint: 'Sẵn sàng gọi khách' },
];

const NEXT_ACTION: Record<ColumnStatus, { to: AdvanceTarget; label: string }> = {
  PAID: { to: 'PREPARING', label: 'Bắt đầu pha' },
  PREPARING: { to: 'READY', label: 'Báo sẵn sàng' },
  READY: { to: 'COMPLETED', label: 'Hoàn tất' },
};

function errorMessage(result: Extract<ActionResult<unknown>, { ok: false }>): string {
  return describeError(result.code, result.details as ApiErrorDetails, 'vi');
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
  const [orders, setOrders] = useState(initialOrders);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<{ orderId: string; message: string } | null>(null);
  const [streamState, setStreamState] = useState<'connecting' | 'live'>('connecting');
  const [cancelOrder, setCancelOrder] = useState<OrderResponseDto | null>(null);
  const [cancelNote, setCancelNote] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  useEffect(() => {
    if (typeof EventSource === 'undefined') return;

    const source = new EventSource('/api/events/staff');
    const refresh = () => router.refresh();

    source.onopen = () => {
      setStreamState('live');
      // A reconnect may have missed frames; the event is a nudge, not the record.
      refresh();
    };
    source.addEventListener('order.status', refresh);
    source.onerror = () => setStreamState('connecting');

    return () => {
      source.removeEventListener('order.status', refresh);
      source.close();
    };
  }, [router]);

  useEffect(() => {
    if (!cancelOrder) return;
    setCancelNote('');
    setCancelError('');
    const timer = window.setTimeout(() => noteRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [cancelOrder]);

  useEffect(() => {
    if (!cancelOrder) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !cancelBusy) setCancelOrder(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cancelOrder, cancelBusy]);

  const advance = async (order: OrderResponseDto) => {
    const action = NEXT_ACTION[order.status as ColumnStatus];
    if (!action) return;

    setBusyId(order.id);
    setError(null);
    const result = await advanceStaffOrderAction({ orderId: order.id, to: action.to });
    setBusyId(null);

    if (!result.ok) {
      setError({ orderId: order.id, message: errorMessage(result) });
      if (result.code === 'INVALID_STATE') router.refresh();
      return;
    }

    setOrders((current) =>
      current
        .map((row) => (row.id === result.data.id ? result.data : row))
        .filter((row) => row.status !== 'COMPLETED'),
    );
    router.refresh();
  };

  const cancel = async () => {
    if (!cancelOrder) return;
    const note = cancelNote.trim();
    if (!note) {
      setCancelError('Nhập lý do hủy đơn.');
      return;
    }

    setCancelBusy(true);
    setCancelError('');
    const result = await cancelPaidOrderAction({ orderId: cancelOrder.id, note });
    setCancelBusy(false);

    if (!result.ok) {
      setCancelError(errorMessage(result));
      if (result.code === 'INVALID_STATE') router.refresh();
      return;
    }

    setOrders((current) => current.filter((row) => row.id !== result.data.id));
    setCancelOrder(null);
    router.refresh();
  };

  const columns = COLUMNS.map((column) => ({
    ...column,
    orders: orders.filter((order) => order.status === column.status),
  }));
  const total = columns.reduce((sum, column) => sum + column.orders.length, 0);

  if (failed) {
    return (
      <div>
        <PageHead
          title="Bảng đơn"
          meta={`Cập nhật ${formatDateTime(lastUpdated, 'vi')}`}
          lede="Đơn đã thanh toán sẽ xuất hiện ở đây khi khách đặt món."
        />
        <EmptyState title="Không tải được bảng đơn">
          Chưa kết nối được hệ thống đơn hàng. Thử làm mới sau ít phút.
        </EmptyState>
      </div>
    );
  }

  return (
    <div>
      <PageHead
        title="Bảng đơn"
        meta={`Cập nhật ${formatDateTime(lastUpdated, 'vi')} · ${total} đơn trên bảng`}
        lede="Ba cột đúng ba trạng thái bếp. Đơn hoàn tất hoặc đã hủy tự rời bảng."
        actions={
          <>
            <Tag tone={streamState === 'live' ? 'success' : 'muted'}>
              {streamState === 'live' ? 'Trực tiếp' : 'Đang kết nối'}
            </Tag>
            <Button size="sm" onClick={() => router.refresh()}>
              Làm mới
            </Button>
          </>
        }
      />

      {total === 0 ? (
        <EmptyState title="Chưa có đơn trên bảng">
          Đơn đã thanh toán sẽ xuất hiện ở đây khi khách đặt món.
        </EmptyState>
      ) : (
        <div className="board">
          {columns.map((column) => (
            <section
              className="board-column"
              key={column.status}
              aria-labelledby={`col-${column.status}`}
            >
              <div className="board-col-head">
                <h2 id={`col-${column.status}`}>{column.title}</h2>
                <span className="board-count">{column.orders.length} đơn</span>
              </div>
              <p
                className="muted"
                style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-2xs)' }}
              >
                {column.hint}
              </p>

              {column.orders.length === 0 ? (
                <div className="board-empty">
                  <h3>Không có đơn</h3>
                  <p>Cột này trống.</p>
                </div>
              ) : (
                column.orders.map((order) => {
                  const busy = busyId === order.id;
                  const rowError = error?.orderId === order.id ? error.message : null;
                  const status = order.status as ColumnStatus;

                  return (
                    <article className="docket" key={order.id} aria-busy={busy}>
                      <div className="docket-head">
                        <span className="docket-no">#{order.orderNo}</span>
                        <span className="docket-time">
                          {formatDateTime(order.createdAt, 'vi').split(' ')[0]}
                        </span>
                      </div>

                      <div className="docket-lines">
                        {order.lines.map((line, index) => (
                          <div className="docket-line" key={`${order.id}-${index}`}>
                            <span className="docket-qty">{line.qty}×</span>
                            <span className="docket-name">
                              {localized(line.productName, 'vi')}
                              <span className="docket-options">
                                Size {line.size}
                                {line.toppings.length > 0
                                  ? `, ${line.toppings
                                      .map((topping) => localized(topping.name, 'vi'))
                                      .join(', ')}`
                                  : ''}
                              </span>
                            </span>
                            <span className="docket-price">
                              {formatVnd(line.lineTotalVnd, 'vi')}
                            </span>
                          </div>
                        ))}
                      </div>

                      {order.note && (
                        <p className="docket-options" style={{ whiteSpace: 'pre-wrap' }}>
                          Ghi chú: {order.note}
                        </p>
                      )}

                      <div className="docket-total">
                        <span>Tổng</span>
                        <span>{formatVnd(order.totalVnd, 'vi')}</span>
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
                            {busy ? 'Đang lưu…' : NEXT_ACTION[status].label}
                          </Button>
                          {status === 'PAID' && canCancel && (
                            <button
                              type="button"
                              className="docket-secondary"
                              disabled={busy}
                              onClick={() => setCancelOrder(order)}
                            >
                              Hủy đơn
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
        <div
          className="modal-layer"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !cancelBusy) setCancelOrder(null);
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-modal-title"
          >
            <div className="modal-head">
              <div>
                <h2 id="cancel-modal-title">Hủy đơn #{cancelOrder.orderNo}</h2>
                <p className="page-meta">Thao tác không hoàn tác được</p>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Đóng"
                disabled={cancelBusy}
                onClick={() => setCancelOrder(null)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-order">
                <span>Đơn đã thanh toán</span>
                <strong>{formatVnd(cancelOrder.totalVnd, 'vi')}</strong>
              </div>

              <Notice tone="warning">
                Đơn sẽ chuyển sang <strong>CANCELLED</strong> và biến mất khỏi bảng bếp. Lý do được
                lưu cùng đơn để đối soát.
              </Notice>

              <div className="field">
                <label htmlFor="cancel-note">
                  Lý do hủy <span className="muted">(bắt buộc)</span>
                </label>
                <textarea
                  id="cancel-note"
                  ref={noteRef}
                  className="input"
                  maxLength={CANCEL_NOTE_MAX}
                  rows={3}
                  value={cancelNote}
                  placeholder="Ví dụ: khách gọi báo đổi món"
                  disabled={cancelBusy}
                  onChange={(event) => setCancelNote(event.target.value)}
                />
                <p className="field-hint">
                  {cancelNote.trim().length}/{CANCEL_NOTE_MAX} ký tự. Chưa nhập lý do thì không thể
                  hủy.
                </p>
              </div>

              {cancelError && (
                <Notice tone="error" role="alert">
                  {cancelError}
                </Notice>
              )}
            </div>

            <div className="modal-actions">
              <Button variant="quiet" disabled={cancelBusy} onClick={() => setCancelOrder(null)}>
                Giữ đơn
              </Button>
              <Button
                variant="danger-fill"
                disabled={cancelBusy || cancelNote.trim().length === 0}
                onClick={cancel}
              >
                {cancelBusy ? 'Đang hủy…' : 'Hủy đơn'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
