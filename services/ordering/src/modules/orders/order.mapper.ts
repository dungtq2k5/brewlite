import { pointsEarnable, zOrderItemToppings } from '@brewlite/contracts';
import type { PricedLine } from '@brewlite/contracts/generated/brewlite/catalog/menu_service.js';
import type {
  Order as OrderProto,
  OrderHistoryEntry,
  OrderLine,
} from '@brewlite/contracts/generated/brewlite/ordering/order_service.js';
import type { Prisma } from '../../../generated/prisma/client.js';

export type OrderRow = Prisma.OrderGetPayload<object>;
export type OrderItemRow = Prisma.OrderItemGetPayload<object>;
export type OrderStatusHistoryRow = Prisma.OrderStatusHistoryGetPayload<object>;

/** The pricing preview from a real `PriceItems` round trip — before any row exists. */
export function toOrderLineFromPriced(line: PricedLine): OrderLine {
  return {
    productId: line.productId,
    productName: line.productName,
    size: line.size,
    toppings: line.toppings.map((t) => ({ toppingId: t.id, name: t.name, priceVnd: t.priceVnd })),
    unitPriceVnd: line.unitPriceVnd,
    qty: line.qty,
    lineTotalVnd: line.lineTotalVnd,
  };
}

/** A placed order's line — reconstructed from its frozen snapshot (rdm-spec §1.4). */
export function toOrderLine(item: OrderItemRow): OrderLine {
  const toppings = zOrderItemToppings.parse(item.toppings);
  return {
    productId: item.productId,
    productName: { en: item.productNameEn, vi: item.productNameVi },
    size: item.size,
    toppings: toppings.map((t) => ({
      toppingId: t.toppingId,
      name: { en: t.nameEn, vi: t.nameVi },
      priceVnd: t.priceVnd,
    })),
    unitPriceVnd: item.unitPriceVnd,
    qty: item.qty,
    lineTotalVnd: item.lineTotalVnd,
  };
}

function toHistoryEntry(row: OrderStatusHistoryRow): OrderHistoryEntry {
  return {
    fromStatus: row.fromStatus ?? undefined,
    toStatus: row.toStatus,
    actorType: row.actorType,
    note: row.note ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

const UNPAID_STATUSES = new Set(['PENDING', 'PAYMENT_FAILED']);

/** `history` is `[]` for a list row (api-endpoints-plan §3.2 — "each item is the Order without history"). */
export function toProtoOrder(
  order: OrderRow,
  items: OrderItemRow[],
  history: OrderStatusHistoryRow[],
): OrderProto {
  return {
    id: order.id,
    orderNo: order.orderNo.toString(),
    status: order.status,
    lines: [...items].sort((a, b) => a.lineNo - b.lineNo).map(toOrderLine),
    subtotalVnd: order.subtotalVnd.toString(),
    promoDiscountVnd: order.promoDiscountVnd,
    pointsDiscountVnd: order.pointsDiscountVnd,
    totalVnd: order.totalVnd.toString(),
    promoCode: order.promoCode ?? undefined,
    pointsEarnable: pointsEarnable(order.totalVnd),
    note: order.note ?? undefined,
    expiresAt: UNPAID_STATUSES.has(order.status) ? order.expiresAt.toISOString() : undefined,
    paidAt: order.paidAt?.toISOString(),
    createdAt: order.createdAt.toISOString(),
    cancelReason: order.cancelReason ?? undefined,
    cancelNote: order.cancelNote ?? undefined,
    refundStatus: order.refundStatus,
    pointsEarned: order.pointsEarned,
    history: history.map(toHistoryEntry),
  };
}
