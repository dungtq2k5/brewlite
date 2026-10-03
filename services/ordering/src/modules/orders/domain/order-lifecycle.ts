import { rpcError } from '@brewlite/nest-common';
import { canTransition, type OrderStatus } from '@brewlite/contracts';

/** The check over `ORDER_TRANSITIONS` (contracts, product-overview §6.4) — the only place that decides. */
export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) throw rpcError('INVALID_STATE', { status: from });
}
