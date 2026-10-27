import { staffOrdersControllerListBoard, type OrderResponseDto } from '@brewlite/api-client';
import { handlePageApiError, requireServerAuth } from '@/lib/api-server';
import { unwrapNullable } from '@/lib/zod-schemas';
import type { MockOrder, OrderStatus } from '@/mocks/admin-data';
import { OrdersClient } from './orders-client';

function mapOrder(dto: OrderResponseDto): MockOrder {
  return {
    id: dto.id,
    orderNo: dto.orderNo,
    customerName: dto.note ? `Khách (${dto.note})` : 'Khách tại quầy',
    status: dto.status as OrderStatus,
    subtotalVnd: dto.subtotalVnd,
    promoDiscountVnd: dto.promoDiscountVnd,
    pointsDiscountVnd: dto.pointsDiscountVnd,
    totalVnd: dto.totalVnd,
    lines: dto.lines.map((l) => ({
      productName: l.productName,
      size: l.size as 'S' | 'M' | 'L',
      quantity: l.qty ?? 1,
      unitPriceVnd: l.unitPriceVnd,
    })),
    cancelNote: unwrapNullable(dto.cancelNote),
    refundStatus: dto.refundStatus,
    createdAt: dto.createdAt,
  };
}

export default async function StaffOrdersPage() {
  await requireServerAuth();
  try {
    const res = await staffOrdersControllerListBoard();
    const body = (res.data as unknown as { data?: OrderResponseDto[] })?.data ?? [];
    return <OrdersClient initialOrders={body.map(mapOrder)} />;
  } catch (err) {
    handlePageApiError(err);
  }
}