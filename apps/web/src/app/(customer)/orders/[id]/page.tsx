import { cache } from 'react';
import { notFound } from 'next/navigation';
import {
  ApiClientError,
  ordersControllerGetOrder,
  paymentsControllerGetPayment,
  type OrderResponseDto,
  type PaymentResponseDto,
} from '@brewlite/api-client';
import { OrderView } from '@/components/order/OrderView';
import { getT } from '@/i18n/server';
import { withRequestId } from '@/lib/with-request-id';

const loadOrder = cache(async (id: string): Promise<OrderResponseDto> => {
  try {
    const res = await ordersControllerGetOrder(id);
    if (res.status === 200 && res.data.data) return res.data.data;
  } catch (error) {
    // A malformed id (400), a missing order and someone else's order (404) are one page.
    if (
      error instanceof ApiClientError &&
      (error.status === 400 || error.code === 'RESOURCE_NOT_FOUND')
    ) {
      notFound();
    }
    throw withRequestId(error);
  }
  throw new Error('GET /orders/:id answered without an order');
});

/** The payment to mount — only while the order waits for one; a missing one is simply none. */
async function loadPayment(order: OrderResponseDto): Promise<PaymentResponseDto | null> {
  if (!order.currentPaymentId) return null;
  if (order.status !== 'PENDING' && order.status !== 'PAYMENT_FAILED') return null;
  try {
    const res = await paymentsControllerGetPayment(order.currentPaymentId);
    return res.status === 200 ? (res.data.data ?? null) : null;
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) return null;
    throw withRequestId(error);
  }
}

export async function generateMetadata({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const [{ id }, { t }] = await Promise.all([params, getT('orders')]);
  const order = await loadOrder(id);
  return { title: t('order.ticket', { no: `#${order.orderNo}` }) };
}

/** `/orders/[id]` — pay while unpaid, then follow the order to the counter (ADR 0022). */
export default async function OrderPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payment?: string | string[] }>;
}>) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const order = await loadOrder(id);
  const payment = await loadPayment(order);
  return <OrderView order={order} payment={payment} returned={query.payment !== undefined} />;
}
