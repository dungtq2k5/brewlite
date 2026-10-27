'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { MockOrder, OrderStatus } from '@/mocks/admin-data';
import { useLocale } from '@/i18n/locale-context';
import { cancelPaidSchema } from '@/lib/zod-schemas';
import { EmptyState } from '@/components/ui/empty-state';
import { cancelPaidOrderAction, updateOrderStatusAction } from './actions';

type ActiveOrderStatus = 'PAID' | 'PREPARING' | 'READY';

export function OrdersClient({ initialOrders }: { initialOrders: MockOrder[] }) {
  const router = useRouter();
  const { tx, tText, money, dateTime } = useLocale();
  const [orders, setOrders] = useState<MockOrder[]>(initialOrders);
  const [filterTab, setFilterTab] = useState<'ALL' | ActiveOrderStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [cancellingOrder, setCancellingOrder] = useState<MockOrder | null>(null);
  const [cancelNote, setCancelNote] = useState('');
  const [cancelModalError, setCancelModalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  function getFriendlyError(code?: string): string {
    if (!code) return tx('Đã xảy ra lỗi khi xử lý thao tác.', 'An error occurred while processing action.');
    if (code.includes('INVALID_STATE') || code.includes('STATE_CONFLICT')) {
      return tx(
        'Trạng thái đơn hàng không hợp lệ để thực hiện thao tác này hoặc đã được cập nhật bởi quầy khác.',
        'Order is in an invalid state for this action or has been updated by another staff.',
      );
    }
    if (code.includes('RESOURCE_NOT_FOUND') || code.includes('ORDER_NOT_FOUND')) {
      return tx('Không tìm thấy đơn hàng trên hệ thống.', 'Order not found.');
    }
    if (code.includes('FORBIDDEN') || code.includes('UNAUTHORIZED')) {
      return tx('Bạn không có quyền thực hiện thao tác này.', 'Permission denied.');
    }
    if (code.includes('CANCEL_REJECTED')) {
      return tx('Chỉ có thể hủy đơn hàng ở trạng thái Chờ pha chế (PAID).', 'Only orders in PAID status can be cancelled.');
    }
    return code;
  }

  function showActionError(msg: string) {
    setActionError(msg);
    setTimeout(() => setActionError(null), 6000);
  }

  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/staff/orders/events');

      const handleStatusFrame = (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data) as {
            orderId?: string;
            orderNo?: number | string;
            status?: OrderStatus;
            at?: string;
            order?: MockOrder;
          };

          if (payload.order) {
            const incoming = payload.order;
            setOrders((prev) => {
              const exists = prev.some((o) => o.id === incoming.id);
              return exists
                ? prev.map((o) => (o.id === incoming.id ? incoming : o))
                : [incoming, ...prev];
            });
            return;
          }

          if (payload.orderId && payload.status) {
            const { orderId, status } = payload;
            setOrders((prev) => {
              const exists = prev.some((o) => o.id === orderId);
              if (exists) {
                return prev.map((o) => (o.id === orderId ? { ...o, status } : o));
              }
              const newOrder: MockOrder = {
                id: orderId,
                orderNo: String(payload.orderNo ?? ''),
                customerName: tx('Khách tại quầy', 'Walk-in Guest'),
                status,
                subtotalVnd: 0,
                promoDiscountVnd: 0,
                pointsDiscountVnd: 0,
                totalVnd: 0,
                lines: [],
                cancelNote: null,
                refundStatus: 'NONE',
                createdAt: payload.at ?? new Date().toISOString(),
              };
              return [newOrder, ...prev];
            });
          }
        } catch {
          // Bỏ qua gói tin ping hoặc parse lỗi
        }
      };

      es.addEventListener('order.status', handleStatusFrame);
      es.onmessage = handleStatusFrame;
    } catch {
      // SSE connection error handling
    }
    return () => {
      es?.close();
    };
  }, [tx]);

  const nextStatusMap: Record<ActiveOrderStatus, { to: OrderStatus; label: string }> = {
    PAID: { to: 'PREPARING', label: tx('Bắt đầu pha chế →', 'Start Preparing →') },
    PREPARING: { to: 'READY', label: tx('Mời nhận tại quầy →', 'Mark Ready →') },
    READY: { to: 'COMPLETED', label: tx('Hoàn tất đơn ✓', 'Complete Order ✓') },
  };

  const activeOrders = orders.filter(
    (o): o is MockOrder & { status: ActiveOrderStatus } => {
      const isStatusActive = o.status === 'PAID' || o.status === 'PREPARING' || o.status === 'READY';
      if (!isStatusActive) return false;
      if (filterTab !== 'ALL' && o.status !== filterTab) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesOrderNo = o.orderNo.toLowerCase().includes(q) || `#${o.orderNo}`.toLowerCase().includes(q);
        const matchesCustomer = o.customerName.toLowerCase().includes(q);
        const matchesProduct = o.lines.some(
          (l) =>
            l.productName.vi.toLowerCase().includes(q) ||
            l.productName.en.toLowerCase().includes(q),
        );
        return matchesOrderNo || matchesCustomer || matchesProduct;
      }

      return true;
    },
  );

  async function handleAdvance(order: MockOrder, to: OrderStatus) {
    if (advancingId) return;
    setAdvancingId(order.id);
    setActionError(null);
    try {
      const res = await updateOrderStatusAction(order.id, to);
      if (res.ok) {
        setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: to } : o)));
        if (to === 'COMPLETED') {
          setNotice(tx(`Đơn #${order.orderNo} đã hoàn tất!`, `Order #${order.orderNo} completed!`));
          setTimeout(() => setNotice(null), 4000);
        }
      } else {
        showActionError(getFriendlyError(res.code));
      }
    } catch {
      showActionError(tx('Lỗi kết nối khi cập nhật đơn hàng.', 'Network error while updating order.'));
    } finally {
      setAdvancingId(null);
    }
  }

  async function handleConfirmCancel(e: FormEvent) {
    e.preventDefault();
    if (!cancellingOrder || cancelling) return;
    const parsed = cancelPaidSchema.safeParse({ note: cancelNote });
    if (!parsed.success) {
      setCancelModalError(tx('Vui lòng nhập lý do tối thiểu 3 ký tự.', 'Please enter at least 3 characters.'));
      return;
    }

    setCancelling(true);
    setCancelModalError(null);
    try {
      const res = await cancelPaidOrderAction(cancellingOrder.id, parsed.data.note);
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === cancellingOrder.id
              ? { ...o, status: 'CANCELLED', cancelNote: parsed.data.note, refundStatus: 'PENDING' }
              : o,
          ),
        );
        setNotice(
          tx(
            `Đã hủy đơn #${cancellingOrder.orderNo} (Lý do: "${parsed.data.note}") và bắt đầu hoàn tiền.`,
            `Cancelled order #${cancellingOrder.orderNo} (Reason: "${parsed.data.note}") and initiated refund.`,
          ),
        );
        setTimeout(() => setNotice(null), 5000);
        setCancellingOrder(null);
        setCancelNote('');
      } else {
        setCancelModalError(getFriendlyError(res.code));
      }
    } catch {
      setCancelModalError(tx('Lỗi kết nối khi hủy đơn hàng.', 'Network error while cancelling order.'));
    } finally {
      setCancelling(false);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 800);
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Thanh trạng thái trực tiếp SSE */}
      <div className="rounded-2xl bg-[#DCE8E6] border border-[#9BB8B3] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[#1E3329]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#1F5C32] animate-pulse inline-block" />
          <span>
            {tx(
              'Cập nhật trực tiếp (SSE) · Bảng đơn hàng đang xử lý tại quầy',
              'Live Updates (SSE) · Active Counter Orders',
            )}
          </span>
        </div>
        <button
          type="button"
          disabled={refreshing}
          onClick={handleRefresh}
          className="px-3.5 py-1 rounded-full bg-[#FCF9F2] border border-[#9B7B60] text-[#4E311E] font-extrabold hover:bg-[#F3ECE1] transition-colors"
        >
          ↻ {refreshing ? '...' : tx('Làm mới danh sách', 'Refresh')}
        </button>
      </div>

      {/* Bộ lọc trạng thái & Tìm kiếm nhanh */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: 'ALL', label: tx('Tất cả đang xử lý', 'All Active') },
            { key: 'PAID', label: tx('1. Chờ pha chế', '1. Waiting to Prepare') },
            { key: 'PREPARING', label: tx('2. Đang pha chế', '2. Preparing') },
            { key: 'READY', label: tx('3. Chờ nhận món', '3. Ready for Pickup') },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilterTab(t.key as typeof filterTab)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ${
                filterTab === t.key
                  ? 'bg-[#4E311E] text-white border-[#4E311E]'
                  : 'bg-[#FCF9F2] text-[#4E311E] border-[#C9B29B] hover:bg-[#F3ECE1]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[200px]">
          <input
            type="text"
            className="input input-sm w-full rounded-full bg-[#FCF9F2] border-[#C9B29B] pr-7 text-xs font-medium placeholder:text-[#8C6A50]"
            placeholder={tx('Tìm số đơn, món, khách...', 'Search order #, item...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#8C6A50] hover:text-[#4E311E]"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Thông báo thành công */}
      {notice && (
        <div className="rounded-2xl bg-[#1F5C32] text-white px-4 py-2.5 text-xs font-bold flex justify-between items-center shadow-sm">
          <span>✓ {notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-white hover:opacity-80">
            ✕
          </button>
        </div>
      )}

      {/* Thông báo lỗi thao tác */}
      {actionError && (
        <div className="rounded-2xl bg-[#B83B2A] text-white px-4 py-2.5 text-xs font-bold flex justify-between items-center shadow-sm">
          <span>⚠️ {actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="text-white hover:opacity-80">
            ✕
          </button>
        </div>
      )}

      {activeOrders.length === 0 ? (
        <div className="rounded-[28px] bg-[#FCF9F2] border-[1.5px] border-[#B59478] p-6">
          <EmptyState
            titleVi={
              searchQuery
                ? `Không tìm thấy đơn hàng khớp với "${searchQuery}"`
                : 'Hiện chưa có đơn hàng nào ở trạng thái này'
            }
            titleEn={
              searchQuery
                ? `No orders matching "${searchQuery}"`
                : 'No active orders in this status'
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeOrders.map((order) => {
            const transition = nextStatusMap[order.status];
            const stepIndex = order.status === 'PAID' ? 1 : order.status === 'PREPARING' ? 2 : 3;
            const isOrderAdvancing = advancingId === order.id;
            const hasDiscounts = order.promoDiscountVnd > 0 || order.pointsDiscountVnd > 0;

            return (
              <div
                key={order.id}
                className="rounded-[28px] bg-[#FCF9F2] border-[1.5px] border-[#B59478] p-5 space-y-3.5 flex flex-col justify-between shadow-sm"
              >
                <div className="text-center space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#8C6A50]">
                    {tx('ĐƠN SỐ', 'ORDER NO.')}
                  </div>
                  <div className="inline-block px-4 py-1 rounded-xl bg-[#4E311E] text-white font-extrabold text-lg">
                    #{order.orderNo}
                  </div>
                  <div className="text-sm font-bold text-[#4E311E] pt-1">
                    {order.customerName} ·{' '}
                    <span className="text-[#B83B2A]">{money(order.totalVnd)}</span>
                  </div>
                  <p className="text-xs text-[#8C6A50]">{dateTime(order.createdAt)}</p>
                </div>

                {/* Danh sách món trong đơn */}
                <div className="rounded-2xl border border-dashed border-[#9B7B60] bg-[#F3ECE1] p-3 text-xs font-medium text-[#4E311E] space-y-1.5">
                  {order.lines.map((line, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span>
                        <strong className="text-[#4E311E]">{line.quantity}x</strong> {tText(line.productName)}{' '}
                        <span className="text-[11px] text-[#8C6A50]">({line.size})</span>
                      </span>
                      <span className="font-bold">{money(line.unitPriceVnd * line.quantity)}</span>
                    </div>
                  ))}

                  {/* Chi tiết giảm giá nếu có */}
                  {hasDiscounts && (
                    <div className="pt-2 mt-1 border-t border-[#C9B29B] space-y-0.5 text-[11px] text-[#6E4F3A]">
                      <div className="flex justify-between">
                        <span>{tx('Tạm tính:', 'Subtotal:')}</span>
                        <span>{money(order.subtotalVnd)}</span>
                      </div>
                      {order.promoDiscountVnd > 0 && (
                        <div className="flex justify-between text-[#B83B2A] font-semibold">
                          <span>{tx('Mã giảm giá:', 'Promo discount:')}</span>
                          <span>-{money(order.promoDiscountVnd)}</span>
                        </div>
                      )}
                      {order.pointsDiscountVnd > 0 && (
                        <div className="flex justify-between text-[#B83B2A] font-semibold">
                          <span>{tx('Điểm tích lũy:', 'Points discount:')}</span>
                          <span>-{money(order.pointsDiscountVnd)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Quy trình tiến độ */}
                <div className="rounded-2xl bg-[#F3ECE1] border border-[#C9B29B] p-3 space-y-2 text-xs">
                  {[
                    { s: 1, label: tx('Đã thanh toán', 'Paid') },
                    { s: 2, label: tx('Đang pha chế', 'Preparing') },
                    { s: 3, label: tx('Mời nhận tại quầy', 'Ready at counter') },
                    { s: 4, label: tx('Hoàn tất', 'Completed') },
                  ].map((step) => {
                    const done = step.s < stepIndex;
                    const current = step.s === stepIndex;
                    return (
                      <div key={step.s} className="flex items-center gap-2.5">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                            done
                              ? 'bg-[#4E311E] text-white'
                              : current
                                ? 'bg-[#A85D00] text-white'
                                : 'border border-[#9B7B60] text-[#8C6A50]'
                          }`}
                        >
                          {done ? '✓' : step.s}
                        </span>
                        <span
                          className={
                            current ? 'font-extrabold text-[#4E311E]' : 'text-[#8C6A50]'
                          }
                        >
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Nút hành động */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  {order.status === 'PAID' && (
                    <button
                      type="button"
                      disabled={isOrderAdvancing}
                      onClick={() => {
                        setCancellingOrder(order);
                        setCancelNote('');
                        setCancelModalError(null);
                      }}
                      className="px-4 py-2.5 rounded-full bg-[#B83B2A] text-white text-xs font-bold hover:bg-[#8F2D1F] transition-colors"
                    >
                      {tx('Hủy & Hoàn tiền', 'Cancel & Refund')}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isOrderAdvancing}
                    onClick={() => void handleAdvance(order, transition.to)}
                    className="flex-1 py-2.5 px-4 rounded-full bg-[#4E311E] text-white text-xs font-bold hover:bg-[#3D2517] disabled:opacity-50 transition-colors"
                  >
                    {isOrderAdvancing ? '...' : transition.label}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Hủy Đơn & Hoàn tiền */}
      {cancellingOrder && (
        <div className="modal modal-open modal-bottom sm:modal-middle">
          <div className="modal-box bg-[#FCF9F2] border border-[#9B7B60] rounded-[28px]">
            <h3 className="font-bold text-lg text-[#B83B2A]">
              {tx(
                `Hủy đơn #${cancellingOrder.orderNo} & Hoàn tiền`,
                `Cancel Order #${cancellingOrder.orderNo} & Refund`,
              )}
            </h3>

            {cancelModalError && (
              <div className="rounded-xl bg-[#B83B2A] text-white p-2.5 mt-2 text-xs font-bold">
                ⚠️ {cancelModalError}
              </div>
            )}

            <form onSubmit={handleConfirmCancel} className="space-y-4 mt-3">
              <fieldset className="fieldset">
                <legend className="fieldset-legend font-bold">
                  {tx('Lý do hủy đơn (Bắt buộc tối thiểu 3 ký tự *)', 'Cancellation Reason (Required min 3 chars *)')}
                </legend>
                <textarea
                  className="textarea textarea-bordered w-full bg-[#F3ECE1] border-[#9B7B60]"
                  rows={3}
                  minLength={3}
                  required
                  placeholder={tx('Nhập lý do hủy (khách đổi ý, hết nguyên liệu,...)', 'Enter reason for cancellation...')}
                  value={cancelNote}
                  onChange={(e) => setCancelNote(e.target.value)}
                />
              </fieldset>
              <div className="modal-action">
                <button
                  type="button"
                  disabled={cancelling}
                  className="px-4 py-2 rounded-full border border-[#9B7B60] text-xs font-bold hover:bg-[#F3ECE1]"
                  onClick={() => setCancellingOrder(null)}
                >
                  {tx('Đóng', 'Close')}
                </button>
                <button
                  type="submit"
                  disabled={cancelling}
                  className="px-5 py-2 rounded-full bg-[#B83B2A] text-white text-xs font-bold hover:bg-[#8F2D1F] disabled:opacity-50"
                >
                  {cancelling ? '...' : tx('Xác nhận Hủy & Hoàn tiền', 'Confirm Cancel & Refund')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}