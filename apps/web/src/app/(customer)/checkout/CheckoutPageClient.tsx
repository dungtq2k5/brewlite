'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { QuoteDto, QuoteResponseDto } from '@brewlite/api-client';
import { MAX_QTY_PER_LINE, newId } from '@brewlite/contracts';
import { EmptyState } from '@/components/vellum/EmptyState';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { useCart, type CartItem } from '@/context/CartContext';
import { formatVnd, localized } from '@/i18n/format';
import type { Locale } from '@/i18n/locale';
import { savePendingOrder } from '@/lib/client-api';
import { describeError, describeUnknownError } from '@/lib/error-messages';
import type { ApiErrorDetails } from '@/lib/gateway-types';
import { startPaymentAction } from '@/lib/payment-actions';
import { placeOrderAction, quoteOrderAction } from './actions';

type UnavailableReason = 'PRODUCT_UNAVAILABLE' | 'OUT_OF_STOCK' | 'OPTION_INVALID';

interface UnavailableLine {
  reason: UnavailableReason;
  /** The product's remaining stock when the refusal is OUT_OF_STOCK. */
  available?: number;
}

interface Props {
  locale: Locale;
  recipient: { fullName: string; email: string };
}

function toLineInputs(items: CartItem[]): QuoteDto['items'] {
  return items.map((item) => ({
    productId: item.productId,
    size: item.size,
    toppingIds: item.toppingIds,
    qty: item.qty,
  }));
}

function unavailableLabel(line: UnavailableLine, isVi: boolean): string {
  if (line.reason === 'OPTION_INVALID') {
    return isVi ? 'Size hoặc topping không còn bán' : 'Size or topping unavailable';
  }
  if (line.reason === 'PRODUCT_UNAVAILABLE') {
    return isVi ? 'Món không còn được bán' : 'No longer available';
  }
  if (typeof line.available === 'number' && line.available > 0) {
    return isVi ? `Chỉ còn ${line.available} phần` : `Only ${line.available} left`;
  }
  return isVi ? 'Tạm thời hết hàng' : 'Temporarily sold out';
}

/** Marks the cart lines the gateway named, or returns null when the code names none. */
function markUnavailable(
  code: string,
  details: ApiErrorDetails,
  items: CartItem[],
): Record<string, UnavailableLine> | null {
  const marked: Record<string, UnavailableLine> = {};

  if (code === 'PRODUCT_UNAVAILABLE') {
    const ids = new Set(details.productIds ?? []);
    for (const item of items) {
      if (ids.has(item.productId)) marked[item.id] = { reason: 'PRODUCT_UNAVAILABLE' };
    }
  } else if (code === 'OUT_OF_STOCK') {
    const availableByProduct = new Map<string, number>();
    for (const row of details.products ?? []) {
      const current = availableByProduct.get(row.productId);
      if (current === undefined || row.available < current) {
        availableByProduct.set(row.productId, row.available);
      }
    }
    for (const item of items) {
      const available = availableByProduct.get(item.productId);
      if (available !== undefined) marked[item.id] = { reason: 'OUT_OF_STOCK', available };
    }
  } else if (code === 'OPTION_INVALID') {
    const line = items[details.lineIndex ?? -1];
    if (line) marked[line.id] = { reason: 'OPTION_INVALID' };
  } else {
    return null;
  }

  return Object.keys(marked).length > 0 ? marked : null;
}

export default function CheckoutPageClient({ locale, recipient }: Props) {
  const router = useRouter();
  const { items, hydrated, updateQty, removeItem, previewSubtotalVnd } = useCart();
  const isVi = locale === 'vi';

  const [quote, setQuote] = useState<QuoteResponseDto | null>(null);
  const [quotedKey, setQuotedKey] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [unavailable, setUnavailable] = useState<Record<string, UnavailableLine>>({});
  const [placing, setPlacing] = useState(false);
  const [orderError, setOrderError] = useState('');

  const [promoDraft, setPromoDraft] = useState('');
  const [appliedPromo, setAppliedPromo] = useState('');
  const [promoError, setPromoError] = useState('');

  const orderKeyRef = useRef<string | null>(null);
  const paymentKeyRef = useRef<string | null>(null);

  const lineInputs = useMemo(() => toLineInputs(items), [items]);
  const quoteKey = useMemo(
    () => JSON.stringify({ items: lineInputs, promoCode: appliedPromo }),
    [lineInputs, appliedPromo],
  );
  const unavailableCount = Object.keys(unavailable).length;
  const itemCount = items.reduce((total, item) => total + item.qty, 0);

  useEffect(() => {
    if (!hydrated) return;
    if (lineInputs.length === 0) {
      setQuote(null);
      setQuotedKey(null);
      setQuoteError('');
      setUnavailable({});
      setQuoting(false);
      return;
    }

    let cancelled = false;
    // A quote is only valid for the exact cart and promo that produced it.
    setQuote(null);
    setQuotedKey(null);
    setQuoteError('');
    setUnavailable({});
    setQuoting(true);

    const timer = setTimeout(async () => {
      try {
        const body: QuoteDto = { items: lineInputs };
        if (appliedPromo) body.promoCode = appliedPromo;
        const result = await quoteOrderAction(body);
        if (cancelled) return;

        if (!result.ok) {
          const details = result.details as unknown as ApiErrorDetails;
          if (result.code === 'UNAUTHENTICATED') {
            router.replace(`/login?next=${encodeURIComponent('/checkout')}`);
            return;
          }

          if (result.code === 'PROMO_CODE_INVALID') {
            setPromoError(describeError(result.code, details, locale));
            setAppliedPromo('');
            setQuote(null);
            setQuotedKey(null);
            return;
          }

          const marked = markUnavailable(result.code, details, items);
          if (marked) {
            setUnavailable((previous) => ({ ...previous, ...marked }));
            setQuote(null);
            setQuotedKey(null);
            setQuoteError(describeError(result.code, details, locale));
            return;
          }

          setQuote(null);
          setQuotedKey(null);
          setQuoteError(describeError(result.code, details, locale));
          return;
        }

        setQuote(result.data);
        setQuotedKey(quoteKey);
        setUnavailable({});
      } catch (error) {
        if (cancelled) return;
        setQuote(null);
        setQuotedKey(null);
        setQuoteError(describeUnknownError(error, locale).message);
      } finally {
        if (!cancelled) setQuoting(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [hydrated, lineInputs, items, appliedPromo, quoteKey, locale, router]);

  const applyPromo = () => {
    const code = promoDraft.trim().toUpperCase();
    if (!code) return;
    setPromoError('');
    setAppliedPromo(code);
    setPromoDraft('');
  };

  const clearPromo = () => {
    setAppliedPromo('');
    setPromoDraft('');
    setPromoError('');
  };

  const handleRemoveUnavailable = (itemId: string) => {
    removeItem(itemId);
    setUnavailable((previous) => {
      const next = { ...previous };
      delete next[itemId];
      return next;
    });
  };

  const handlePlaceOrder = async () => {
    if (
      !quote ||
      quotedKey !== quoteKey ||
      placing ||
      unavailableCount > 0 ||
      lineInputs.length === 0
    ) {
      return;
    }

    setPlacing(true);
    setOrderError('');

    // Kept across a failed attempt: a retried PlaceOrder must not create a second order.
    const orderKey = (orderKeyRef.current ??= newId());

    try {
      const body: QuoteDto = { items: lineInputs };
      if (appliedPromo) body.promoCode = appliedPromo;

      const orderResult = await placeOrderAction({ ...body, idempotencyKey: orderKey });
      if (!orderResult.ok) {
        const details = orderResult.details as unknown as ApiErrorDetails;
        if (orderResult.code === 'UNAUTHENTICATED') {
          router.replace(`/login?next=${encodeURIComponent('/checkout')}`);
          return;
        }
        const marked = markUnavailable(orderResult.code, details, items);
        if (marked) setUnavailable((previous) => ({ ...previous, ...marked }));
        setOrderError(describeError(orderResult.code, details, locale));
        return;
      }

      const order = orderResult.data;
      orderKeyRef.current = null;
      savePendingOrder(order.id);

      try {
        const paymentKey = (paymentKeyRef.current ??= newId());
        const paymentResult = await startPaymentAction({
          orderId: order.id,
          idempotencyKey: paymentKey,
        });
        if (paymentResult.ok) {
          paymentKeyRef.current = null;
          router.replace(`/orders/${order.id}?payment=${paymentResult.data.id}`);
        } else {
          router.replace(`/orders/${order.id}`);
        }
      } catch {
        // The order exists; the tracking page can create or resume its payment.
        router.replace(`/orders/${order.id}`);
      }
    } catch (error) {
      setOrderError(describeUnknownError(error, locale).message);
    } finally {
      setPlacing(false);
    }
  };

  if (!hydrated) {
    return (
      <>
        <PageHead title={isVi ? 'Thanh toán' : 'Checkout'} />
        <p className="notice" role="status">
          {isVi ? 'Đang tải giỏ hàng…' : 'Loading the cart…'}
        </p>
      </>
    );
  }

  if (items.length === 0) {
    return (
      <>
        <PageHead
          title={isVi ? 'Thanh toán' : 'Checkout'}
          meta={isVi ? 'Chưa có món nào.' : 'No items yet.'}
        />
        <EmptyState
          title={isVi ? 'Chưa có món để thanh toán' : 'Nothing to check out'}
          action={
            <Link className="btn btn--primary" href="/">
              {isVi ? 'Xem thực đơn' : 'Browse the menu'}
            </Link>
          }
        >
          {isVi
            ? 'Giỏ hàng đang trống. Chọn một ly cà phê hoặc trà trước nhé.'
            : 'Your cart is empty. Pick a coffee or tea first.'}
        </EmptyState>
      </>
    );
  }

  const hasUnavailable = unavailableCount > 0;
  const totalVnd = quote?.totalVnd ?? previewSubtotalVnd;
  const promoDiscountVnd = quote?.promoDiscountVnd ?? 0;
  const promoCode = quote?.promoCode ?? appliedPromo;
  const promoVerified =
    !!quote &&
    quotedKey === quoteKey &&
    appliedPromo.length > 0 &&
    quote.promoCode === appliedPromo;
  const canPlaceOrder =
    !!quote && quotedKey === quoteKey && !hasUnavailable && !quoting && !placing;
  const quotePending = quoting || (!quote && !quoteError);

  const placeLabel = placing
    ? isVi
      ? 'Đang tạo đơn…'
      : 'Placing order…'
    : quotePending
      ? isVi
        ? 'Đang kiểm tra đơn…'
        : 'Checking your order…'
      : hasUnavailable
        ? isVi
          ? 'Xóa món hết hàng để tiếp tục'
          : 'Remove sold-out items to continue'
        : isVi
          ? `Đặt đơn · ${formatVnd(totalVnd, locale)}`
          : `Place order · ${formatVnd(totalVnd, locale)}`;

  return (
    <>
      <PageHead
        title={isVi ? 'Thanh toán' : 'Checkout'}
        meta={
          isVi
            ? `Bước 2 / 2 · ${itemCount} món, ${items.length} dòng · nhận tại quầy`
            : `Step 2 / 2 · ${itemCount} items, ${items.length} lines · counter pickup`
        }
        actions={
          <Link className="btn btn--quiet" href="/cart">
            ← {isVi ? 'Giỏ hàng' : 'Cart'}
          </Link>
        }
      />

      <div className="checkout-layout">
        <div className="checkout-main">
          {quoteError && (
            <Notice tone="error" role="alert">
              {quoteError}
            </Notice>
          )}

          {orderError && (
            <Notice tone="error" role="alert">
              {orderError}
            </Notice>
          )}

          <section className="panel">
            <div className="panel-head">
              <h2>{isVi ? 'Người nhận' : 'Recipient'}</h2>
              <span className="tag tag--success">{isVi ? 'Đã đăng nhập' : 'Signed in'}</span>
            </div>
            <div className="panel-body stack">
              <div className="field-row">
                <div className="field">
                  <label htmlFor="checkout-name">{isVi ? 'Họ tên' : 'Full name'}</label>
                  <input id="checkout-name" type="text" value={recipient.fullName} readOnly />
                </div>
                <div className="field">
                  <label htmlFor="checkout-email">Email</label>
                  <input id="checkout-email" type="email" value={recipient.email} readOnly />
                </div>
              </div>
              <div className="well" style={{ padding: 'var(--space-sm) var(--space-md)' }}>
                <p className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                  {isVi ? 'Phương thức nhận' : 'Fulfilment'}
                </p>
                <p style={{ fontWeight: 600, marginTop: 'var(--space-3xs)' }}>
                  {isVi ? 'Nhận tại quầy BrewLite' : 'Pick up at the BrewLite counter'}
                </p>
                <p className="fine">
                  {isVi
                    ? 'Thanh toán trước, đọc số đơn tại quầy. Quán không giao hàng.'
                    : 'Pay first, then show your order number at the counter. No delivery.'}
                </p>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>{isVi ? 'Món đã chọn' : 'Selected items'}</h2>
              <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                {items.length} {isVi ? 'dòng' : 'lines'}
              </span>
            </div>
            <div className="panel-body" style={{ paddingTop: 0, paddingBottom: 0 }}>
              {items.map((item, index) => {
                const issue = unavailable[item.id];
                const quotedLine = quote?.lines[index];
                const lineTotalVnd = quotedLine?.lineTotalVnd ?? item.unitPriceVnd * item.qty;

                return (
                  <div className="checkout-line" key={item.id}>
                    <div>
                      <h3>{localized(item.name, locale)}</h3>
                      <p className="checkout-line-meta">
                        Size {item.size}
                        {item.toppingNames.length > 0 && (
                          <>
                            {' · '}
                            {item.toppingNames.map((name) => localized(name, locale)).join(', ')}
                          </>
                        )}
                        {' · '}
                        {isVi ? 'SL' : 'Qty'} {item.qty}
                      </p>

                      {issue ? (
                        <p
                          style={{
                            marginTop: 'var(--space-2xs)',
                            color: 'var(--color-error)',
                            fontSize: 'var(--text-xs)',
                            fontWeight: 600,
                          }}
                        >
                          {unavailableLabel(issue, isVi)}
                        </p>
                      ) : (
                        <div
                          className="stepper"
                          role="group"
                          aria-label={isVi ? 'Số lượng' : 'Quantity'}
                          style={{ marginTop: 'var(--space-2xs)' }}
                        >
                          <button
                            type="button"
                            onClick={() => updateQty(item.id, -1)}
                            disabled={item.qty <= 1 || placing}
                            aria-label={isVi ? 'Giảm số lượng' : 'Decrease quantity'}
                          >
                            −
                          </button>
                          <output>{item.qty}</output>
                          <button
                            type="button"
                            onClick={() => updateQty(item.id, 1)}
                            disabled={placing || item.qty >= MAX_QTY_PER_LINE}
                            aria-label={isVi ? 'Tăng số lượng' : 'Increase quantity'}
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        justifyItems: 'end',
                        alignContent: 'start',
                        gap: 'var(--space-2xs)',
                      }}
                    >
                      <span className="money">{formatVnd(lineTotalVnd, locale)}</span>
                      {issue ? (
                        <button
                          className="remove-link"
                          type="button"
                          onClick={() => handleRemoveUnavailable(item.id)}
                        >
                          {isVi ? 'Xóa món này' : 'Remove item'}
                        </button>
                      ) : (
                        quoting &&
                        !quote && (
                          <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                            {isVi ? 'Đang kiểm tra giá…' : 'Checking price…'}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>{isVi ? 'Mã khuyến mãi' : 'Promo code'}</h2>
              {appliedPromo && (
                <span className={promoVerified ? 'tag tag--accent' : 'tag'}>{appliedPromo}</span>
              )}
            </div>
            <div className="panel-body stack">
              {appliedPromo && (
                <div className="promo-applied">
                  <div>
                    <span className="promo-code">{appliedPromo}</span>
                    <p>
                      {promoVerified
                        ? quote && quote.promoDiscountVnd > 0
                          ? isVi
                            ? `Giảm ${formatVnd(quote.promoDiscountVnd, locale)}`
                            : `${formatVnd(quote.promoDiscountVnd, locale)} off`
                          : isVi
                            ? 'Mã không giảm giá đơn này'
                            : 'This code does not discount this order'
                        : quoting
                          ? isVi
                            ? 'Đang kiểm tra mã…'
                            : 'Checking the code…'
                          : quoteError
                            ? isVi
                              ? 'Chưa kiểm tra được mã'
                              : "Couldn't check the code"
                            : isVi
                              ? 'Đang kiểm tra mã…'
                              : 'Checking the code…'}
                    </p>
                  </div>
                  <button className="btn btn--sm" type="button" onClick={clearPromo}>
                    {isVi ? 'Bỏ mã' : 'Remove'}
                  </button>
                </div>
              )}

              <div className="promo-row">
                <label className="visually-hidden" htmlFor="promo">
                  {isVi ? 'Nhập mã khuyến mãi' : 'Enter a promo code'}
                </label>
                <input
                  className="input"
                  id="promo"
                  type="text"
                  value={promoDraft}
                  onChange={(event) => setPromoDraft(event.target.value.toUpperCase())}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      applyPromo();
                    }
                  }}
                  placeholder={
                    appliedPromo ? (isVi ? 'Nhập mã khác' : 'Enter another code') : 'BREW20'
                  }
                  autoComplete="off"
                />
                <button
                  className="btn"
                  type="button"
                  onClick={applyPromo}
                  disabled={!promoDraft.trim()}
                >
                  {isVi ? 'Áp dụng' : 'Apply'}
                </button>
              </div>

              {promoError && (
                <p className="field-hint" style={{ color: 'var(--color-error)' }} role="alert">
                  {promoError}
                </p>
              )}
              <p className="field-hint">
                {isVi
                  ? 'Mã được kiểm tra ở bước báo giá của máy chủ. Mã sai hoặc hết hạn sẽ báo lỗi ngay tại đây.'
                  : 'The server checks the code in its quote. A bad or expired code is reported here.'}
              </p>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>{isVi ? 'Thanh toán' : 'Payment'}</h2>
              <span className="tag">{isVi ? 'Trực tuyến' : 'Online'}</span>
            </div>
            <div className="panel-body stack">
              <label className="check">
                <input type="radio" name="payment" defaultChecked />
                <span>
                  {isVi ? 'Thanh toán trực tuyến' : 'Pay online'}
                  <small>
                    {isVi
                      ? 'Đơn được tạo trước, sau đó cổng thanh toán mở ở trang theo dõi đơn.'
                      : 'The order is created first; payment opens on the tracking page.'}
                  </small>
                </span>
              </label>
              <p className="notice notice--warning">
                {isVi
                  ? 'Đơn chỉ vào bảng bếp sau khi thanh toán thành công. Nếu thanh toán lỗi, đơn giữ trạng thái chờ và có thể thử lại trong trang đơn.'
                  : 'An order reaches the bar only after payment succeeds. A failed payment stays pending and can be retried from the order page.'}
              </p>
            </div>
          </section>
        </div>

        <aside
          className="panel summary checkout-summary fibre"
          aria-label={isVi ? 'Tóm tắt thanh toán' : 'Checkout summary'}
        >
          <h2>{isVi ? 'Tóm tắt' : 'Summary'}</h2>
          <dl>
            <div className="summary-row">
              <dt>{isVi ? 'Tạm tính' : 'Subtotal'}</dt>
              <dd>{formatVnd(quote?.subtotalVnd ?? previewSubtotalVnd, locale)}</dd>
            </div>
            {promoDiscountVnd > 0 && (
              <div className="summary-row">
                <dt>{promoCode || (isVi ? 'Khuyến mãi' : 'Discount')}</dt>
                <dd>−{formatVnd(promoDiscountVnd, locale)}</dd>
              </div>
            )}
            <div className="summary-row summary-total">
              <dt>{isVi ? 'Thanh toán' : 'Total'}</dt>
              <dd>{quotePending ? '…' : formatVnd(totalVnd, locale)}</dd>
            </div>
          </dl>

          {quote && quote.pointsEarnable > 0 && (
            <p className="fine" style={{ textAlign: 'right' }}>
              {isVi
                ? `Đơn này tích ${quote.pointsEarnable} điểm`
                : `Earn ${quote.pointsEarnable} points with this order`}
            </p>
          )}

          <button
            className="btn btn--primary btn--block"
            type="button"
            onClick={handlePlaceOrder}
            disabled={!canPlaceOrder}
          >
            {placeLabel}
          </button>
          <p className="fine">
            {isVi
              ? 'Bằng việc đặt đơn, bạn đồng ý thanh toán trực tuyến trước khi nhận món. Đơn đã thanh toán chỉ có thể hủy qua nhân viên.'
              : 'By placing the order you agree to pay online before pickup. A paid order can only be cancelled by staff.'}
          </p>
        </aside>
      </div>
    </>
  );
}
