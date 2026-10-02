import type { StockReservation as StockReservationProto } from '@brewlite/contracts/generated/brewlite/catalog/stock_service.js';
import type { Prisma } from '../../../generated/prisma/client.js';

export const STOCK_RESERVATION_SELECT = {
  orderId: true,
  productId: true,
  qty: true,
  status: true,
} satisfies Prisma.StockReservationSelect;

export type StockReservationRow = Prisma.StockReservationGetPayload<{
  select: typeof STOCK_RESERVATION_SELECT;
}>;

export function toProtoStockReservation(row: StockReservationRow): StockReservationProto {
  return { orderId: row.orderId, productId: row.productId, qty: row.qty, status: row.status };
}
