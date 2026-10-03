import { OrderStatus } from './enums.js';

/**
 * product-overview §6.4, as data. `COMPLETED` and `CANCELLED` are terminal — every move
 * not listed here is refused. The web app reads this to show which buttons apply; the
 * **check** that throws (`assertTransition`) is ordering's own, over this same table.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.PAYMENT_FAILED, OrderStatus.CANCELLED],
  [OrderStatus.PAYMENT_FAILED]: [OrderStatus.PENDING, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY],
  [OrderStatus.READY]: [OrderStatus.COMPLETED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}
