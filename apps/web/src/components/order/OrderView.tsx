'use client';

import { ChevronLeft, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import type { OrderResponseDto, PaymentResponseDto } from '@brewlite/api-client';
import { cancelOrder } from '@/actions/orders';
import { formatVnd, localized } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';
import { useCart } from '@/lib/cart/CartProvider';
import { formatOrderDate } from '@/lib/order-date';
import { clockTime } from '@/lib/order/deadline';
import { Alert } from '../Alert';
import { QuoteSummary } from '../checkout/QuoteSummary';
import { InstallInvitation } from '../InstallInvitation';
import { useErrorMessage } from '../useErrorMessage';
import { CancelSheet } from './CancelSheet';
import { Deadline } from './Deadline';
import { OrderTicket } from './OrderTicket';
import { PaymentFrame } from './PaymentFrame';
import { RefundNotice } from './RefundNotice';
import { StatusBadge } from './StatusBadge';
import { Timeline } from './Timeline';
import { useOrderStream } from './useOrderStream';

/** Statuses after which the cart that made the order is spent (handoff decision 6). */
const PAID_ON = new Set(['PAID', 'PREPARING', 'READY', 'COMPLETED']);

function messageKey(order: OrderResponseDto): string {
  if (order.status !== 'CANCELLED') return `order.message.${order.status}`;
  if (order.cancelReason === 'CUSTOMER') return 'order.message.CANCELLED_CUSTOMER';
  if (order.cancelReason === 'STAFF') {
    return order.cancelNote
      ? 'order.message.CANCELLED_STAFF'
      : 'order.message.CANCELLED_STAFF_NO_NOTE';
  }
  return 'order.message.CANCELLED_EXPIRED';
}

/**
 * `/orders/[id]`: pay while unpaid, then follow the order to the counter. The server renders the
 * order; this component keeps it fresh (`useOrderStream` re-reads it on every event) and owns what a
 * status *does* on the device — the cart, the tab title, one buzz when it is ready.
 */
export function OrderView({
  order,
  payment,
  returned,
}: Readonly<{ order: OrderResponseDto; payment: PaymentResponseDto | null; returned: boolean }>) {
  const { t, i18n } = useTranslation(['orders', 'menu']);
  const locale = i18n.language as Locale;
  const router = useRouter();
  const message = useErrorMessage();
  const { clearIfPlaced } = useCart();
  const { live, reconnecting } = useOrderStream(order.id, order.status);

  const [justConfirmed, setJustConfirmed] = useState(false);
  const [deadlinePassed, setDeadlinePassed] = useState(false);
  const [deadlineNote, setDeadlineNote] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelling, startCancel] = useTransition();
  const onPassed = useCallback(() => setDeadlinePassed(true), []);

  const { status } = order;
  const payable = status === 'PENDING' || status === 'PAYMENT_FAILED';
  const ready = status === 'READY';

  // The cart that made this order is spent once the order is paid (and, for a refunded
  // cancellation, still paid: the money moved).
  useEffect(() => {
    if (PAID_ON.has(status) || (status === 'CANCELLED' && order.paidAt)) clearIfPlaced(order.id);
  }, [status, order.id, order.paidAt, clearIfPlaced]);

  // READY: the tab says so, and the phone buzzes once — at once if the page is in view,
  // otherwise when it next is.
  const buzzed = useRef<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    const previous = document.title;
    document.title = t('order.readyTitle', { no: order.orderNo });
    const buzz = () => {
      if (buzzed.current === order.id) return;
      buzzed.current = order.id;
      navigator.vibrate?.(200);
    };
    if (document.visibilityState === 'visible') buzz();
    const onVisible = () => document.visibilityState === 'visible' && buzz();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.title = previous;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [ready, order.id, order.orderNo, t]);

  const confirmCancel = () =>
    startCancel(async () => {
      const result = await cancelOrder(order.id);
      setCancelOpen(false);
      if (!result.ok) {
        setCancelError(
          result.code === 'INVALID_STATE'
            ? t('order.cancel.invalidState')
            : message(result.code, result.details),
        );
      }
      router.refresh();
    });

  const lines = order.lines.map((line) => {
    const toppings = line.toppings.map((tp) => localized(tp.name, locale)).join(', ');
    return {
      key: `${line.productId}|${line.size}|${line.toppings.map((tp) => tp.toppingId).join(',')}`,
      name: localized(line.productName, locale),
      details: [t(`menu:product.size.name.${line.size}`), toppings].filter(Boolean).join(' · '),
      qty: line.qty,
      total: line.lineTotalVnd,
    };
  });

  const title = t(`${messageKey(order)}.title`, { defaultValue: '' });
  const body = t(`${messageKey(order)}.body`, {
    defaultValue: '',
    no: order.orderNo,
    time: order.expiresAt ? clockTime(order.expiresAt) : '',
  });
  // Cancelled messages are one sentence, not a title and a body.
  const sentence = status === 'CANCELLED' ? t(messageKey(order), { note: order.cancelNote }) : '';

  const itemCount = order.lines.reduce((sum, line) => sum + line.qty, 0);

  return (
    <div className="mx-auto max-w-5xl py-4 lg:py-8">
      <Link href="/orders" className="mb-4 inline-flex min-h-11 items-center gap-1 font-medium">
        <ChevronLeft aria-hidden size={18} />
        {t('title')}
      </Link>
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start lg:gap-12">
        <div className="flex flex-col gap-5">
          <header className="flex flex-col items-center gap-3 text-center">
            {!ready && <OrderTicket orderNo={order.orderNo} size="large" />}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <StatusBadge status={status} />
              {live && (
                <span className="text-success flex items-center gap-1 text-sm font-medium">
                  <span aria-hidden className="bg-success size-2 rounded-full" />
                  {t('order.live')}
                </span>
              )}
              {reconnecting && (
                <span role="status" className="text-warning text-sm font-medium">
                  {t('order.reconnecting')}
                </span>
              )}
            </div>
            <p className="text-base-content/70 text-sm">
              {t('order.placed', { date: formatOrderDate(order.createdAt, locale) })}
            </p>
          </header>

          {/* READY is loud: the whole hero is the alert, so assistive tech reads it the moment it lands. */}
          {ready ? (
            <section
              role="alert"
              className="bg-base-100 border-success rounded-box flex flex-col items-center gap-3 border-2 p-6 text-center"
            >
              <OrderTicket orderNo={order.orderNo} size="large" tone="ready" />
              <h1 className="text-2xl font-bold">{t('order.message.READY.title')}</h1>
              <p>{t('order.message.READY.body', { no: order.orderNo })}</p>
            </section>
          ) : (
            <section className="bg-base-200 rounded-box p-5">
              {status === 'CANCELLED' ? (
                <h1 className="text-lg font-semibold">{sentence}</h1>
              ) : (
                <>
                  <h1 className="text-xl font-bold">{title}</h1>
                  {body && <p className="mt-1">{body}</p>}
                </>
              )}
              {status === 'PAID' && order.pointsEarned > 0 && (
                <p className="text-primary mt-2 flex items-center gap-2 text-sm font-semibold">
                  <Sparkles aria-hidden size={16} />
                  {t('order.points', { count: order.pointsEarned })}
                </p>
              )}
            </section>
          )}

          {/* One polite voice for status changes; READY speaks through its alert instead. */}
          <div role="status" className="sr-only">
            {!ready && title}
            {deadlineNote}
          </div>

          <RefundNotice order={order} />
          {cancelError && <Alert type="error">{cancelError}</Alert>}

          {payable && order.expiresAt && (
            <Deadline
              expiresAt={order.expiresAt}
              onPassed={onPassed}
              onAnnounce={setDeadlineNote}
            />
          )}
          {payable && (
            <PaymentFrame
              orderId={order.id}
              orderStatus={status}
              hasPayment={order.currentPaymentId !== null}
              payment={payment}
              amountVnd={order.totalVnd}
              returned={returned}
              deadlinePassed={deadlinePassed}
              justConfirmed={justConfirmed}
              onSimulatedSuccess={() => setJustConfirmed(true)}
            />
          )}

          {!payable && <Timeline history={order.history} />}
          {status === 'COMPLETED' && <InstallInvitation variant="inline" />}
        </div>

        <section
          aria-labelledby="order-title"
          className="lg:bg-base-200 lg:rounded-box flex flex-col gap-3 lg:p-5"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="order-title" className="text-lg font-semibold">
              {t('order.yourOrder')}
            </h2>
            <span className="text-base-content/70 text-sm">
              {t('order.items', { count: itemCount })}
            </span>
          </div>
          <ul>
            {lines.map((line) => (
              <li key={line.key} className="flex gap-3 py-2">
                <span className="text-base-content/70 w-6 shrink-0 tabular-nums">{line.qty}×</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{line.name}</p>
                  {line.details && <p className="text-base-content/70 text-sm">{line.details}</p>}
                </div>
                <span className="font-semibold tabular-nums">{formatVnd(line.total, locale)}</span>
              </li>
            ))}
          </ul>
          {order.note && (
            <p className="text-sm">
              <span className="font-semibold">{t('order.note')}: </span>
              {order.note}
            </p>
          )}
          <QuoteSummary
            subtotalVnd={order.subtotalVnd}
            promoCode={order.promoCode}
            promoDiscountVnd={order.promoDiscountVnd}
            totalVnd={order.totalVnd}
          />
        </section>
      </div>

      {payable && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setCancelError(null);
              setCancelOpen(true);
            }}
          >
            {t('order.cancel.button')}
          </button>
        </div>
      )}
      {cancelOpen && (
        <CancelSheet
          orderNo={order.orderNo}
          pending={cancelling}
          onConfirm={confirmCancel}
          onClose={() => setCancelOpen(false)}
        />
      )}
    </div>
  );
}
