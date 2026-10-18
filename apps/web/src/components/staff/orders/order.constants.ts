import type { BoardStatus, OrderColumnConfig, OrderFilter, OrderStatus } from './order.types';
export const ORDER_COLUMNS: readonly OrderColumnConfig[] = [
  {
    status: 'PAID',
    title: 'Đã thanh toán',
    action: 'Bắt đầu pha',
    nextStatus: 'PREPARING',
  },
  {
    status: 'PREPARING',
    title: 'Đang pha',
    action: 'Đánh dấu sẵn sàng',
    nextStatus: 'READY',
  },
  {
    status: 'READY',
    title: 'Chờ nhận',
    action: 'Đã giao khách',
    nextStatus: 'COMPLETED',
  },
];
export const ORDER_FILTERS: readonly {
  value: OrderFilter;
  label: string;
}[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'PAID', label: 'Đã thanh toán' },
  { value: 'PREPARING', label: 'Đang pha' },
  { value: 'READY', label: 'Chờ nhận' },
];
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Chờ thanh toán',
  PAYMENT_FAILED: 'Thanh toán thất bại',
  PAID: 'Đã thanh toán',
  PREPARING: 'Đang pha',
  READY: 'Chờ nhận',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};
export const ORDER_BADGE_CLASSES: Record<BoardStatus, string> = {
  PAID: 'bg-[#f0d4b0] text-[#684329]',
  PREPARING: 'bg-[#724a33] text-[#fffaf2]',
  READY: 'bg-[#dfe9df] text-[#4f6b5b]',
};
export const DEFAULT_VISIBLE_ORDERS = 4;
export const LOAD_MORE_ORDERS = 10;
export function getOrderBadgeClass(status: OrderStatus): string {
  if (status === 'PAID' || status === 'PREPARING' || status === 'READY') {
    return ORDER_BADGE_CLASSES[status];
  }
  return 'bg-[#f2ece4] text-[#734932]';
}
