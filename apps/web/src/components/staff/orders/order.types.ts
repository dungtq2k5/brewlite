import type { BoardStatus, Order } from '@/lib/staff/contracts';
export type { Order, OrderLine, BoardStatus } from '@/lib/staff/contracts';
export type OrderStatus = Order['status'];
export type OrderFilter = 'all' | BoardStatus;
export type OrderColumnConfig = {
  status: BoardStatus;
  title: string;
  action: string;
  nextStatus: 'PREPARING' | 'READY' | 'COMPLETED';
};
export type OrderStats = {
  paid: number;
  preparing: number;
  ready: number;
  processing: number;
};
