import type { ProductSize } from '@brewlite/contracts';
import type {
  Order as OrderProto,
  OrderHistoryEntry as OrderHistoryEntryProto,
  OrderLine as OrderLineProto,
  QuoteResponse as QuoteResponseProto,
} from '@brewlite/contracts/generated/brewlite/ordering/order_service.js';
import type { OrderResponseDto, QuoteResponseDto } from './dto/order.dto.js';

function toOrderLineDto(line: OrderLineProto) {
  return {
    productId: line.productId,
    productName: { en: line.productName?.en ?? '', vi: line.productName?.vi ?? '' },
    size: line.size as ProductSize,
    toppings: line.toppings.map((t) => ({
      toppingId: t.toppingId,
      name: { en: t.name?.en ?? '', vi: t.name?.vi ?? '' },
      priceVnd: t.priceVnd,
    })),
    unitPriceVnd: line.unitPriceVnd,
    qty: line.qty,
    lineTotalVnd: line.lineTotalVnd,
  };
}

function toHistoryEntryDto(entry: OrderHistoryEntryProto) {
  return {
    fromStatus: entry.fromStatus ?? null,
    toStatus: entry.toStatus,
    actorType: entry.actorType,
    note: entry.note ?? null,
    createdAt: entry.createdAt,
  };
}

export function toQuoteResponseDto(proto: QuoteResponseProto): QuoteResponseDto {
  return {
    lines: proto.lines.map(toOrderLineDto),
    subtotalVnd: Number(proto.subtotalVnd),
    promoDiscountVnd: proto.promoDiscountVnd,
    pointsDiscountVnd: proto.pointsDiscountVnd,
    totalVnd: Number(proto.totalVnd),
    promoCode: proto.promoCode ?? null,
    pointsEarnable: proto.pointsEarnable,
  };
}

export function toOrderResponseDto(proto: OrderProto): OrderResponseDto {
  return {
    id: proto.id,
    orderNo: proto.orderNo,
    status: proto.status,
    lines: proto.lines.map(toOrderLineDto),
    subtotalVnd: Number(proto.subtotalVnd),
    promoDiscountVnd: proto.promoDiscountVnd,
    pointsDiscountVnd: proto.pointsDiscountVnd,
    totalVnd: Number(proto.totalVnd),
    promoCode: proto.promoCode ?? null,
    pointsEarnable: proto.pointsEarnable,
    note: proto.note ?? null,
    expiresAt: proto.expiresAt ?? null,
    paidAt: proto.paidAt ?? null,
    createdAt: proto.createdAt,
    cancelReason: proto.cancelReason ?? null,
    cancelNote: proto.cancelNote ?? null,
    refundStatus: proto.refundStatus,
    pointsEarned: proto.pointsEarned,
    history: proto.history.map(toHistoryEntryDto),
  };
}
