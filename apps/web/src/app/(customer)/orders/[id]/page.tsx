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
  const user = await requireUser(nextPath);

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
  // Fetch both the session in the URL and the order's current one: a refresh that was
  // already in flight when the customer opened a replacement can land with the old id.
  const paymentIds = Array.from(
    new Set([rawPaymentId, order.currentPaymentId].filter((id): id is string => Boolean(id))),
  );
  const payments = new Map<string, PaymentResponseDto>();

  for (const paymentId of paymentIds) {
    try {
      const candidate = unwrap<PaymentResponseDto>(
        (await paymentsControllerGetPayment(paymentId)).data,
      );
      // A stale or foreign id simply means "no session to show"; try the next one.
      if (candidate.orderId === order.id) payments.set(paymentId, candidate);
    } catch {
      // Ignore and continue with the order's current payment id, if any.
    }
  }

  const requested = rawPaymentId ? (payments.get(rawPaymentId) ?? null) : null;
  const current = order.currentPaymentId ? (payments.get(order.currentPaymentId) ?? null) : null;
  // A Stripe return URL can still be the session worth showing before its webhook updates
  // the order. A settled (FAILED/EXPIRED) URL, however, must yield to the replacement
  // session the customer just opened; otherwise the page keeps offering "new payment"
  // forever while the live session sits unrendered.
  const requestedStatus = String(requested?.status ?? '').toUpperCase();
  const requestedSettled = requestedStatus === 'FAILED' || requestedStatus === 'EXPIRED';
  const payment =
    requestedSettled && current && current.id !== requested?.id ? current : (requested ?? current);

  // Keep the address bar on the session actually rendered. A live refresh started
  // before the client replaced the stale id can otherwise land afterwards and
  // restore the old query string.
  if (rawPaymentId && rawPaymentId !== payment?.id) {
    redirect(payment ? `/orders/${order.id}?payment=${encodeURIComponent(payment.id)}` : nextPath);
  }

  return (
    <OrderDetailClient order={order} payment={payment} locale={locale} cardholder={user.fullName} />
  );
}
