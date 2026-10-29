'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import type { OrderResponseDto, PaymentResponseDto } from '@brewlite/api-client';
import { newId } from '@brewlite/contracts';
import { Notice } from '@/components/vellum/Notice';
import { useCart } from '@/context/CartContext';
import { formatDateTime, formatVnd, localized } from '@/i18n/format';
import type { Locale } from '@/i18n/locale';
import { clearPendingOrder, readPendingOrder } from '@/lib/client-api';
import { describeError, describeUnknownError } from '@/lib/error-messages';
import type { ApiErrorDetails } from '@/lib/gateway-types';
import { isLiveOrderStatus, orderStatusUi } from '@/lib/order-status';
import { startPaymentAction } from '@/lib/payment-actions';
import { cancelOrderAction } from './actions';

interface Props {
  order: OrderResponseDto;
  payment: PaymentResponseDto | null;
  locale: Locale;
}

interface ErrorEnvelope {
  error?: { code?: unknown; details?: unknown };
}

const TIMELINE = [
  { step: 1, toStatus: 'PAID', vi: 'Đã thanh toán', en: 'Paid' },
  { step: 2, toStatus: 'PREPARING', vi: 'Đang pha chế', en: 'Preparing' },
  { step: 3, toStatus: 'READY', vi: 'Chờ nhận tại quầy', en: 'Ready for pickup' },
  { step: 4, toStatus: 'COMPLETED', vi: 'Hoàn tất', en: 'Completed' },
];

const PAID_STATUSES = ['PAID', 'PREPARING', 'READY', 'COMPLETED'];
const PAYABLE_STATUSES = ['PENDING', 'PAYMENT_FAILED'];

const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
let stripePromise: Promise<Stripe | null> | null = null;

/** Loads Stripe.js once, and only in the browser; `loadStripe` is SSR-safe. */
function getStripePromise(): Promise<Stripe | null> | null {
  if (!STRIPE_PUBLISHABLE_KEY) return null;
  return (stripePromise ??= loadStripe(STRIPE_PUBLISHABLE_KEY));
}

function StripeCheckout({ clientSecret }: { clientSecret: string }) {
  const stripe = getStripePromise();
  if (!stripe) return null;
  return (
    <EmbeddedCheckoutProvider stripe={stripe} options={{ clientSecret }}>
      <EmbeddedCheckout />
    </EmbeddedCheckoutProvider>
  );
}

function displayOrderNo(order: OrderResponseDto): string {
  const raw = order.orderNo || order.id.slice(-5).toUpperCase();
  return raw.startsWith('#') ? raw : `#${raw}`;
}

function formatTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function paymentLabel(status: string | undefined, isVi: boolean): string {
  switch (status) {
    case 'PENDING':
      return isVi ? 'Đang chờ thanh toán' : 'Awaiting payment';
    case 'SUCCEEDED':
      return isVi ? 'Đã thanh toán' : 'Paid';
    case 'FAILED':
      return isVi ? 'Thanh toán thất bại' : 'Payment failed';
    case 'EXPIRED':
      return isVi ? 'Phiên thanh toán hết hạn' : 'Payment expired';
    default:
      return isVi ? 'Chưa tạo' : 'Not started';
  }
}

function cancelReasonLabel(reason: string, isVi: boolean): string {
  switch (reason.toUpperCase()) {
    case 'CUSTOMER':
      return isVi ? 'Bạn đã hủy đơn hàng này.' : 'You cancelled this order.';
    case 'EXPIRED':
      return isVi ? 'Đơn đã hết hạn thanh toán và bị hủy.' : 'The payment window expired.';
    case 'STAFF':
      return isVi ? 'Quán đã hủy đơn hàng này.' : 'The shop cancelled this order.';
    default:
      return reason;
  }
}

class PaymentConfirmError extends Error {
  readonly code: string;
  readonly details: unknown;

  constructor(code: string, details: unknown) {
    super(code);
    this.name = 'PaymentConfirmError';
    this.code = code;
    this.details = details;
  }
}

/**
 * The fake provider's confirm route is deliberately excluded from the OpenAPI contract
 * (api-endpoints-plan §3), so this is the one hand-written call beside SSE.
 */
async function confirmFakePayment(
  paymentId: string,
  outcome: 'SUCCEEDED' | 'FAILED',
): Promise<void> {
  const response = await fetch(`/api/v1/payments/${paymentId}/fake-confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ outcome }),
    cache: 'no-store',
    credentials: 'same-origin',
  });

  if (response.ok) return;

  const body = (await response.json().catch(() => null)) as unknown;
  const envelope =
    body && typeof body === 'object' && 'error' in body ? (body as ErrorEnvelope).error : undefined;
  throw new PaymentConfirmError(
    typeof envelope?.code === 'string' ? envelope.code : 'INTERNAL',
    envelope?.details,
  );
}

export default function OrderDetailClient({ order, payment, locale }: Props) {
  const router = useRouter();
  const { clearCart } = useCart();
  const isVi = locale === 'vi';

  const [refreshing, startRefresh] = useTransition();
  const [paymentBusy, setPaymentBusy] = useState<'SUCCEEDED' | 'FAILED' | 'CREATE' | null>(null);
  const [paymentError, setPaymentError] = useState('');
  const [cancelArmed, setCancelArmed] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [streamState, setStreamState] = useState<'connecting' | 'live' | 'polling'>('connecting');
  const paymentKeyRef = useRef<string | null>(null);

  const currentStatus = String(order.status ?? '').toUpperCase();
  const live = isLiveOrderStatus(currentStatus);
  const loginUrl = `/login?next=${encodeURIComponent(`/orders/${order.id}`)}`;

  useEffect(() => {
    if (!live) return;

    let pollTimer: number | null = null;
    const startPolling = () => {
      if (pollTimer !== null) return;
      pollTimer = window.setInterval(() => router.refresh(), 5000);
    };
    const stopPolling = () => {
      if (pollTimer === null) return;
      window.clearInterval(pollTimer);
      pollTimer = null;
    };

    // A proxy that strips streaming still leaves a working page: poll the same
    // server component until the stream is usable again (ADR 0022).
    if (typeof EventSource === 'undefined') {
      setStreamState('polling');
      startPolling();
      return stopPolling;
    }

    const source = new EventSource(`/api/events/orders/${encodeURIComponent(order.id)}`);
    const onStatus = () => {
      setStreamState('live');
      router.refresh();
    };

    source.onopen = () => {
      stopPolling();
      setStreamState('live');
      // A reconnect may have missed frames; the event is a nudge, not the record.
      router.refresh();
    };
    source.addEventListener('order.status', onStatus);
    source.onerror = () => {
      setStreamState(source.readyState === EventSource.CLOSED ? 'polling' : 'connecting');
      startPolling();
    };

    return () => {
      source.removeEventListener('order.status', onStatus);
      source.close();
      stopPolling();
    };
  }, [live, order.id, router]);

  // The confirmation page clears the cart only for the order this browser just placed,
  // and only once the order is actually PAID (architecture §4.3).
  useEffect(() => {
    if (currentStatus !== 'PAID') return;
    if (readPendingOrder() !== order.id) return;
    clearCart();
    clearPendingOrder();
  }, [clearCart, currentStatus, order.id]);

  const startPayment = async () => {
    setPaymentBusy('CREATE');
    setPaymentError('');
    const key = (paymentKeyRef.current ??= newId());

    try {
      const result = await startPaymentAction({ orderId: order.id, idempotencyKey: key });
      if (!result.ok) {
        if (result.code === 'UNAUTHENTICATED') {
          router.replace(loginUrl);
          return;
        }
        setPaymentError(
          describeError(result.code, result.details as unknown as ApiErrorDetails, locale),
        );
        return;
      }

      paymentKeyRef.current = null;
      router.replace(`/orders/${order.id}?payment=${result.data.id}`);
    } catch (error) {
      setPaymentError(describeUnknownError(error, locale).message);
    } finally {
      setPaymentBusy(null);
    }
  };

  const confirmPayment = async (outcome: 'SUCCEEDED' | 'FAILED') => {
    if (!payment) return;
    setPaymentBusy(outcome);
    setPaymentError('');

    try {
      await confirmFakePayment(payment.id, outcome);
      startRefresh(() => router.refresh());
    } catch (error) {
      const described = describeUnknownError(error, locale);
      if (described.code === 'UNAUTHENTICATED') {
        router.replace(loginUrl);
        return;
      }
      setPaymentError(described.message);
    } finally {
      setPaymentBusy(null);
    }
  };

  const cancelOrder = async () => {
    if (cancelBusy) return;
    setCancelBusy(true);
    setCancelError('');

    try {
      const result = await cancelOrderAction(order.id);
      if (!result.ok) {
        if (result.code === 'UNAUTHENTICATED') {
          router.replace(loginUrl);
          return;
        }
        setCancelError(
          describeError(result.code, result.details as unknown as ApiErrorDetails, locale),
        );
        if (result.code === 'INVALID_STATE') {
          startRefresh(() => router.refresh());
        }
        return;
      }

      if (readPendingOrder() === order.id) clearPendingOrder();
      setCancelArmed(false);
      startRefresh(() => router.refresh());
    } catch (error) {
      setCancelError(describeUnknownError(error, locale).message);
    } finally {
      setCancelBusy(false);
    }
  };

  const ui = orderStatusUi(currentStatus);
  const showTimeline = currentStatus !== 'CANCELLED' && currentStatus !== 'PAYMENT_FAILED';
  const paidAt = order.paidAt;
  const promoCode = order.promoCode ?? '';
  const paid = PAID_STATUSES.includes(currentStatus);
  const awaitingPayment = PAYABLE_STATUSES.includes(currentStatus);
  const paymentSettled = payment?.status === 'FAILED' || payment?.status === 'EXPIRED';
  const clientSecret = payment?.clientSecret ?? null;
  const stripePending = payment?.provider === 'STRIPE' && payment.status === 'PENDING';
  const stripeReady = stripePending && !!clientSecret && !!STRIPE_PUBLISHABLE_KEY;
  const canFakeConfirm =
    awaitingPayment && payment?.provider === 'FAKE' && payment.status === 'PENDING';
  const canCreatePayment = awaitingPayment && (!payment || paymentSettled);

  let hint = isVi ? 'Cảm ơn bạn đã ủng hộ BrewLite!' : 'Thank you for supporting BrewLite!';
  if (currentStatus === 'PENDING') {
    hint = isVi
      ? 'Đơn đang chờ thanh toán. Hoàn tất thanh toán để quán bắt đầu pha chế.'
      : 'Pending payment. Complete payment to start preparation.';
  } else if (currentStatus === 'PAID') {
    hint = isVi
      ? 'Đã thanh toán. Quầy sẽ bắt đầu pha chế ngay.'
      : 'Paid. The counter will start preparing your order.';
  } else if (currentStatus === 'PREPARING') {
    hint = isVi
      ? 'Quầy đã nhận đơn. Bạn không cần làm gì thêm; màn hình này tự cập nhật khi nhân viên chuyển trạng thái.'
      : 'The counter has your order. Nothing to do; this page updates as staff move it along.';
  } else if (currentStatus === 'READY') {
    hint = isVi
      ? 'Lấy món tại quầy nhé — đọc số đơn cho nhân viên.'
      : 'Ready for pickup — please show your order number.';
  } else if (currentStatus === 'PAYMENT_FAILED') {
    hint = isVi
      ? 'Thanh toán chưa thành công. Thử lại thanh toán từ trang này.'
      : 'Payment did not go through. Retry it from this page.';
  } else if (currentStatus === 'CANCELLED') {
    const reason = order.cancelReason;
    hint = reason
      ? cancelReasonLabel(reason, isVi)
      : isVi
        ? 'Đơn hàng đã được hủy.'
        : 'Order has been cancelled.';
  }

  return (
    <div className="order-layout">
      <div>
        <div className="order-hero">
          <p className="page-meta">{isVi ? 'Đơn hàng của bạn' : 'Your order'}</p>
          <span className="order-no">{displayOrderNo(order)}</span>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 'var(--space-xs)',
              marginTop: 'var(--space-sm)',
            }}
            aria-live="polite"
            aria-atomic="true"
          >
            <p className="order-status" style={{ marginTop: 0 }}>
              {isVi ? ui.vi : ui.en}
            </p>
            {live && (
              <span
                className={
                  streamState === 'polling'
                    ? 'tag tag--warning'
                    : streamState === 'live'
                      ? 'tag tag--success'
                      : 'tag'
                }
              >
                {streamState === 'polling'
                  ? isVi
                    ? 'Tự động làm mới'
                    : 'Auto-refreshing'
                  : streamState === 'live'
                    ? isVi
                      ? 'Đang cập nhật'
                      : 'Live'
                    : isVi
                      ? 'Đang kết nối'
                      : 'Connecting'}
              </span>
            )}
          </div>
          <p className="order-hint">{hint}</p>
          <div className="order-actions">
            <button
              className="btn"
              type="button"
              onClick={() => startRefresh(() => router.refresh())}
              disabled={refreshing}
            >
              {refreshing ? (isVi ? 'Đang làm mới…' : 'Refreshing…') : isVi ? 'Làm mới' : 'Refresh'}
            </button>
            <Link className="btn btn--quiet" href="/orders">
              {isVi ? 'Tất cả đơn' : 'All orders'}
            </Link>
            {awaitingPayment && (
              <button
                className="btn btn--danger"
                type="button"
                onClick={() => {
                  setCancelError('');
                  setCancelArmed(true);
                }}
                disabled={cancelBusy || refreshing || cancelArmed}
              >
                {isVi ? 'Hủy đơn' : 'Cancel order'}
              </button>
            )}
          </div>

          {cancelError && (
            <Notice tone="error" role="alert">
              {cancelError}
            </Notice>
          )}

          {cancelArmed && awaitingPayment && (
            <div
              className="notice notice--warning"
              role="group"
              aria-label={isVi ? 'Xác nhận hủy đơn' : 'Confirm cancellation'}
            >
              <p>
                {isVi
                  ? 'Hủy đơn này? Món sẽ được trả về kho và không thể hoàn tác.'
                  : 'Cancel this order? Stock is released and this cannot be undone.'}
              </p>
              <div className="order-actions" style={{ marginTop: 'var(--space-sm)' }}>
                <button
                  className="btn btn--danger-fill"
                  type="button"
                  onClick={() => void cancelOrder()}
                  disabled={cancelBusy || refreshing}
                >
                  {cancelBusy
                    ? isVi
                      ? 'Đang hủy…'
                      : 'Cancelling…'
                    : isVi
                      ? 'Xác nhận hủy'
                      : 'Confirm cancellation'}
                </button>
                <button
                  className="btn btn--quiet"
                  type="button"
                  onClick={() => {
                    setCancelArmed(false);
                    setCancelError('');
                  }}
                  disabled={cancelBusy}
                >
                  {isVi ? 'Giữ đơn' : 'Keep order'}
                </button>
              </div>
            </div>
          )}
        </div>

        {showTimeline && (
          <div className="timeline" aria-label={isVi ? 'Tiến trình đơn' : 'Order progress'}>
            {TIMELINE.map((item) => {
              const done = ui.step >= item.step;
              const current = ui.step === item.step;
              const history = order.history.find(
                (row) => String(row.toStatus).toUpperCase() === item.toStatus,
              );
              return (
                <div
                  className={['timeline-step', done && 'is-done', current && 'is-current']
                    .filter(Boolean)
                    .join(' ')}
                  key={item.step}
                >
                  <span className="step-num">{String(item.step).padStart(2, '0')}</span>
                  <span className="step-name">
                    {isVi ? item.vi : item.en}{' '}
                    {current && (
                      <span className="tag tag--warning">{isVi ? 'Hiện tại' : 'Current'}</span>
                    )}
                  </span>
                  <span className="step-time">
                    {history
                      ? formatTime(history.createdAt, locale)
                      : isVi
                        ? 'Chưa tới'
                        : 'Not yet'}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {awaitingPayment && (
          <section className="panel" style={{ marginTop: 'var(--space-lg)' }}>
            <div className="panel-head">
              <h2>{isVi ? 'Thanh toán' : 'Payment'}</h2>
              <span className="tag" aria-live="polite">
                {paymentLabel(payment?.status, isVi)}
              </span>
            </div>
            <div className="panel-body stack">
              {paymentError && (
                <Notice tone="error" role="alert">
                  {paymentError}
                </Notice>
              )}

              {canFakeConfirm ? (
                <>
                  <p className="notice notice--warning">
                    {isVi
                      ? 'Cổng thanh toán giả lập chỉ dùng khi phát triển. Hai nút dưới gọi thẳng cổng giả lập để tạo đúng sự kiện như webhook thật.'
                      : 'The fake payment provider is development-only. The buttons below call it directly to produce the same events as a real webhook.'}
                  </p>
                  <div className="order-actions" style={{ marginTop: 0 }}>
                    <button
                      className="btn btn--primary"
                      type="button"
                      onClick={() => void confirmPayment('SUCCEEDED')}
                      disabled={paymentBusy !== null || refreshing}
                    >
                      {paymentBusy === 'SUCCEEDED'
                        ? isVi
                          ? 'Đang xác nhận…'
                          : 'Confirming…'
                        : isVi
                          ? 'Mô phỏng thành công'
                          : 'Simulate success'}
                    </button>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => void confirmPayment('FAILED')}
                      disabled={paymentBusy !== null || refreshing}
                    >
                      {paymentBusy === 'FAILED'
                        ? isVi
                          ? 'Đang xác nhận…'
                          : 'Confirming…'
                        : isVi
                          ? 'Mô phỏng thất bại'
                          : 'Simulate failure'}
                    </button>
                  </div>
                </>
              ) : canCreatePayment ? (
                <>
                  <p className="fine" style={{ marginTop: 0 }}>
                    {paymentSettled
                      ? isVi
                        ? 'Phiên thanh toán trước đã kết thúc. Mở phiên mới để tiếp tục.'
                        : 'The previous payment session ended. Open a new one to continue.'
                      : isVi
                        ? 'Tiếp tục thanh toán cho đơn này.'
                        : 'Continue paying for this order.'}
                  </p>
                  <div className="order-actions" style={{ marginTop: 0 }}>
                    <button
                      className="btn btn--primary"
                      type="button"
                      onClick={() => void startPayment()}
                      disabled={paymentBusy !== null || refreshing}
                    >
                      {paymentBusy === 'CREATE'
                        ? isVi
                          ? 'Đang mở…'
                          : 'Opening…'
                        : paymentSettled
                          ? isVi
                            ? 'Tạo thanh toán mới'
                            : 'New payment'
                          : isVi
                            ? 'Mở thanh toán'
                            : 'Continue payment'}
                    </button>
                  </div>
                </>
              ) : stripePending ? (
                stripeReady && clientSecret ? (
                  <>
                    <p className="fine" style={{ marginTop: 0 }}>
                      {isVi
                        ? 'Thanh toán thẻ được xử lý trên Stripe. Bạn sẽ quay lại trang này sau khi hoàn tất; trạng thái đơn chỉ đổi khi cổng thanh toán xác nhận.'
                        : 'Card payment is handled by Stripe. You return to this page afterwards; the order changes only when the provider confirms.'}
                    </p>
                    <StripeCheckout clientSecret={clientSecret} />
                  </>
                ) : (
                  <Notice tone="warning" role="status">
                    {!STRIPE_PUBLISHABLE_KEY
                      ? isVi
                        ? 'Thanh toán thẻ chưa được cấu hình trên bản này. Vui lòng liên hệ quầy BrewLite để hoàn tất đơn.'
                        : 'Card payment is not configured on this build. Please ask the BrewLite counter to complete the order.'
                      : isVi
                        ? 'Stripe đang xác nhận thanh toán. Trang sẽ tự cập nhật khi cổng thanh toán báo về.'
                        : 'Stripe is confirming the payment. This page updates when the provider responds.'}
                  </Notice>
                )
              ) : (
                <p className="fine" style={{ marginTop: 0 }}>
                  {isVi
                    ? 'Đơn đang chờ cổng thanh toán xác nhận. Trang này tự cập nhật khi thanh toán xong.'
                    : 'The payment provider is confirming. This page updates when payment completes.'}
                </p>
              )}
            </div>
          </section>
        )}

        <p className="fine">
          {isVi
            ? 'Trạng thái lấy trực tiếp từ đơn hàng: PENDING → PAID → PREPARING → READY → COMPLETED. Đơn chưa thanh toán có thể hủy tại đây; đơn đã thanh toán chỉ hủy được qua nhân viên.'
            : 'Status comes from the order itself: PENDING → PAID → PREPARING → READY → COMPLETED. Unpaid orders can be cancelled here; a paid order can only be cancelled by staff.'}
        </p>
      </div>

      <aside className="panel receipt fibre" aria-label={isVi ? 'Hoá đơn' : 'Receipt'}>
        <h2>{isVi ? 'Hoá đơn' : 'Receipt'}</h2>

        {order.lines.map((line, index) => (
          <div className="receipt-line" key={`${line.productId}-${index}`}>
            <div>
              {line.qty} × {localized(line.productName, locale)}
              <span className="receipt-line-meta">
                Size {line.size}
                {line.toppings.length > 0 && (
                  <>
                    {', '}
                    {line.toppings.map((topping) => localized(topping.name, locale)).join(', ')}
                  </>
                )}
              </span>
            </div>
            <span className="money">{formatVnd(line.lineTotalVnd, locale)}</span>
          </div>
        ))}

        <div className="receipt-line">
          <div>{isVi ? 'Tạm tính' : 'Subtotal'}</div>
          <span className="money">{formatVnd(order.subtotalVnd, locale)}</span>
        </div>

        {order.promoDiscountVnd > 0 && (
          <div className="receipt-line">
            <div>
              {isVi ? 'Khuyến mãi' : 'Promotion'} {promoCode}
            </div>
            <span className="money">−{formatVnd(order.promoDiscountVnd, locale)}</span>
          </div>
        )}

        {order.pointsDiscountVnd > 0 && (
          <div className="receipt-line">
            <div>{isVi ? 'Điểm tích lũy' : 'Loyalty points'}</div>
            <span className="money">−{formatVnd(order.pointsDiscountVnd, locale)}</span>
          </div>
        )}

        <div className="receipt-total">
          <span>{paid ? (isVi ? 'Đã thanh toán' : 'Paid') : isVi ? 'Tổng cộng' : 'Total'}</span>
          <span>{formatVnd(order.totalVnd, locale)}</span>
        </div>

        <p className="fine">
          {paidAt
            ? isVi
              ? `Thanh toán lúc ${formatDateTime(paidAt, locale)}.`
              : `Paid at ${formatDateTime(paidAt, locale)}.`
            : awaitingPayment
              ? isVi
                ? 'Chưa thanh toán. Đơn chỉ vào bảng bếp sau khi thanh toán thành công.'
                : 'Not paid yet. The order reaches the bar only after payment succeeds.'
              : isVi
                ? 'Chưa có thời điểm thanh toán.'
                : 'No payment time recorded.'}
          {!paid && order.pointsEarnable > 0 && (
            <>
              {' '}
              {isVi
                ? `Đơn này tích ${order.pointsEarnable} điểm khi thanh toán.`
                : `This order earns ${order.pointsEarnable} points once paid.`}
            </>
          )}
        </p>
      </aside>
    </div>
  );
}
