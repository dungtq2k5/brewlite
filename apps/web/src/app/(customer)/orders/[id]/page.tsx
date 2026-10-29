import {
  ApiClientError,
  ordersControllerGetOrder,
  paymentsControllerGetPayment,
  type OrderResponseDto,
  type PaymentResponseDto,
} from '@brewlite/api-client';
import { notFound, redirect } from 'next/navigation';
import { getLocale } from '@/i18n/locale.server';
import { isUnauthenticated, unwrap } from '@/lib/api-server';
import { requireUser } from '@/lib/session';
import OrderDetailClient from './OrderDetailClient';

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payment?: string | string[] }>;
}

export default async function OrderDetailPage({ params, searchParams }: OrderDetailPageProps) {
  const [{ id }, query, locale] = await Promise.all([params, searchParams, getLocale()]);
  const nextPath = `/orders/${id}`;
  await requireUser(nextPath);

  let order: OrderResponseDto;
  try {
    order = unwrap<OrderResponseDto>((await ordersControllerGetOrder(id)).data);
  } catch (error) {
    if (isUnauthenticated(error)) {
      redirect(`/login?next=${encodeURIComponent(nextPath)}`);
    }
    // A malformed id is a 400; someone else's order is a 404. Neither page exists.
    if (
      error instanceof ApiClientError &&
      (error.status === 400 || error.status === 404 || error.status === 422)
    ) {
      notFound();
    }
    throw error;
  }

  const rawPaymentId = Array.isArray(query.payment) ? query.payment[0] : query.payment;
  // Prefer the payment from the Stripe return URL; otherwise resume the order's
  // current payment so a PENDING order opened from history can mount Stripe directly.
  const paymentIds = Array.from(
    new Set([rawPaymentId, order.currentPaymentId].filter((id): id is string => Boolean(id))),
  );
  let payment: PaymentResponseDto | null = null;

  for (const paymentId of paymentIds) {
    try {
      const candidate = unwrap<PaymentResponseDto>(
        (await paymentsControllerGetPayment(paymentId)).data,
      );
      // A stale or foreign id simply means "no session to show"; try the next one.
      if (candidate.orderId === order.id) {
        payment = candidate;
        break;
      }
    } catch {
      // Ignore and continue with the order's current payment id, if any.
    }
  }

  return <OrderDetailClient order={order} payment={payment} locale={locale} />;
}
