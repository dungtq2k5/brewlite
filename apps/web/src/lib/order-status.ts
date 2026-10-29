/** Customer-facing labels, Vellum tag tones and timeline positions for an order status. */
export interface OrderStatusUi {
  vi: string;
  en: string;
  tag: string;
  step: number;
}

const ORDER_STATUS_UI: Record<string, OrderStatusUi> = {
  PENDING: { vi: 'Chờ thanh toán', en: 'Pending payment', tag: 'tag--warning', step: 0 },
  PAID: { vi: 'Đã thanh toán', en: 'Paid', tag: 'tag--success', step: 1 },
  PREPARING: { vi: 'Đang pha chế', en: 'Preparing', tag: 'tag--warning', step: 2 },
  READY: { vi: 'Chờ nhận', en: 'Ready for pickup', tag: 'tag--success', step: 3 },
  COMPLETED: { vi: 'Hoàn tất', en: 'Completed', tag: 'tag--muted', step: 4 },
  PAYMENT_FAILED: { vi: 'Thanh toán lỗi', en: 'Payment failed', tag: 'tag--error', step: 0 },
  CANCELLED: { vi: 'Đã hủy', en: 'Cancelled', tag: 'tag--error', step: 0 },
};

export const LIVE_ORDER_STATUSES = ['PENDING', 'PAYMENT_FAILED', 'PAID', 'PREPARING', 'READY'];

export function orderStatusUi(status: string | undefined): OrderStatusUi {
  const code = String(status ?? '').toUpperCase();
  return ORDER_STATUS_UI[code] ?? { vi: code, en: code, tag: 'tag', step: 0 };
}

export function isLiveOrderStatus(status: string | undefined): boolean {
  return LIVE_ORDER_STATUSES.includes(String(status ?? '').toUpperCase());
}
