'use client';

import { LoaderCircle, Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import type { PaymentResponseDto } from '@brewlite/api-client';
import { newId } from '@brewlite/contracts';
import { startPayment } from '@/actions/payments';
import { formatVnd } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';
import { choosePaymentView } from '@/lib/order/payment-state';
import { FakePayment } from './FakePayment';
import { hasStripeKey, StripeCheckout } from './StripeCheckout';

/**
 * Where the order is paid (D03 §4): a state per situation, never a guess. Payment **starts on
 * arrival** for a fresh `PENDING` order — `CreatePayment` hands back the open payment whatever the
 * key, so a reload or a second tab never makes a second one. `PAYMENT_FAILED` waits for a tap.
 */
export function PaymentFrame({
  orderId,
  orderStatus,
  hasPayment,
  payment,
  amountVnd,
  returned,
  deadlinePassed,
  justConfirmed,
  onSimulatedSuccess,
}: Readonly<{
  orderId: string;
  orderStatus: string;
  hasPayment: boolean;
  payment: PaymentResponseDto | null;
  amountVnd: number;
  returned: boolean;
  deadlinePassed: boolean;
  justConfirmed: boolean;
  onSimulatedSuccess: () => void;
}>) {
  const { t, i18n } = useTranslation('orders');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [startError, setStartError] = useState<'unavailable' | 'notPayable' | null>(null);
  const key = useRef(newId());
  const arrived = useRef(false);

  const start = useCallback(
    () =>
      startTransition(async () => {
        setStartError(null);
        const result = await startPayment(orderId, key.current);
        if (result.ok) return router.refresh();
        setStartError(result.code === 'ORDER_NOT_PAYABLE' ? 'notPayable' : 'unavailable');
      }),
    [orderId, router],
  );

  // On arrival at a fresh order. A ref, not state: React's development double effect must not
  // start twice (the server would answer with the same payment anyway).
  useEffect(() => {
    if (arrived.current || orderStatus !== 'PENDING' || hasPayment) return;
    arrived.current = true;
    start();
  }, [orderStatus, hasPayment, start]);

  const view = choosePaymentView({
    orderStatus,
    payment,
    starting: pending,
    startError,
    deadlinePassed,
    returned,
    justConfirmed,
    hasStripeKey,
  });
  const noKey = view === 'unavailable' && payment?.provider === 'STRIPE' && !hasStripeKey;
  useEffect(() => {
    if (noKey)
      console.error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set — card payments are off');
  }, [noKey]);
  if (view === 'none') return null;

  const tryAgain = () => {
    // A payment that failed or closed is over: the next one is a new intent, a new key.
    if (view === 'failed' || view === 'closed') key.current = newId();
    start();
  };

  if (view === 'confirming') {
    return (
      <section role="status" className="rounded-box border-base-300 flex flex-col gap-2 border p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <LoaderCircle aria-hidden size={20} className="animate-spin motion-reduce:animate-none" />
          {t('order.pay.confirming.title')}
        </h2>
        <p>{t('order.pay.confirming.body')}</p>
      </section>
    );
  }
  if (view === 'notPayable') {
    return (
      <section className="rounded-box border-base-300 flex flex-col gap-3 border p-5">
        <p>{t('order.pay.notPayable.body')}</p>
        <Link href="/cart" className="btn btn-primary">
          {t('order.pay.notPayable.action')}
        </Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="pay-title" className="rounded-box border-base-300 border p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 id="pay-title" className="text-xl font-bold">
          {t('order.pay.title', { amount: formatVnd(amountVnd, i18n.language as Locale) })}
        </h2>
        {view === 'stripe' && (
          <span className="text-base-content/70 flex items-center gap-1 text-xs">
            <Lock aria-hidden size={12} />
            {t('order.pay.secure')}
          </span>
        )}
      </div>
      {view === 'loading' && (
        <p role="status" className="flex items-center gap-2">
          <LoaderCircle aria-hidden size={18} className="animate-spin motion-reduce:animate-none" />
          {t('order.pay.loading')}
        </p>
      )}
      {view === 'stripe' && payment?.clientSecret && (
        <StripeCheckout clientSecret={payment.clientSecret} />
      )}
      {view === 'fake' && payment && (
        <FakePayment paymentId={payment.id} onSucceeded={onSimulatedSuccess} />
      )}
      {(view === 'failed' || view === 'closed' || view === 'unavailable') && (
        <div className="flex flex-col gap-3">
          <p role="alert">
            {view === 'failed' && t('order.pay.failed.body')}
            {view === 'closed' && t('order.pay.closed')}
            {view === 'unavailable' && t(noKey ? 'order.pay.noStripeKey' : 'order.pay.unavailable')}
          </p>
          {!noKey && (
            <button type="button" className="btn btn-primary" disabled={pending} onClick={tryAgain}>
              {t('order.pay.failed.retry')}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
