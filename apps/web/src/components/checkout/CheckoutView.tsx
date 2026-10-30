'use client';

import { ChevronLeft, Info, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { QuoteResponseDto } from '@brewlite/api-client';
import { newId, ORDER_UNPAID_TTL_MS } from '@brewlite/contracts';
import { placeOrder, quoteCart } from '@/actions/orders';
import { errorMessage } from '@/i18n/error-message';
import { formatVnd, localized } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';
import { useCart } from '@/lib/cart/CartProvider';
import {
  mapRefusal,
  stockLeftFor,
  toQuoteItems,
  unavailableFor,
  type Refusal,
} from '@/lib/checkout/refusals';
import { Alert } from '../Alert';
import { CartLine, type LinePricing } from '../cart/CartLine';
import { UndoRow } from '../cart/UndoRow';
import { useUndoableRemove } from '../cart/useUndoableRemove';
import { NoteField } from './NoteField';
import { PromoField } from './PromoField';
import { QuoteSummary } from './QuoteSummary';

const DEBOUNCE_MS = 400;

type QuoteState =
  | { status: 'idle' }
  | { status: 'ok'; sig: string; data: QuoteResponseDto }
  | { status: 'refused'; sig: string; refusal: Refusal; atPlace?: boolean }
  | { status: 'failed'; sig: string };

/**
 * `/checkout`: the cart's lines priced by the **server** (never the preview), re-quoted after every
 * change, then *Place order*. The quote never edits the cart — every change is the customer's.
 */
export function CheckoutView() {
  const { t, i18n } = useTranslation(['checkout', 'cart', 'errors', 'menu']);
  const locale = i18n.language as Locale;
  const router = useRouter();
  const { cart, ready, setQuantity, markPlaced } = useCart();
  const { removed, onRemove, onUndo, expire } = useUndoableRemove();

  const lines = cart.lines;
  const items = useMemo(() => toQuoteItems(lines), [lines]);

  const [promoInput, setPromoInput] = useState('');
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [promoRefusal, setPromoRefusal] = useState<Extract<Refusal, { kind: 'promo' }> | null>(
    null,
  );
  const [note, setNote] = useState('');
  const [quote, setQuote] = useState<QuoteState>({ status: 'idle' });
  const [lastPriced, setLastPriced] = useState<QuoteResponseDto | null>(null);
  const [retry, setRetry] = useState(0);
  const [placing, setPlacing] = useState(false);
  const [contended, setContended] = useState(false);

  const sequence = useRef(0);
  const immediate = useRef(false);
  const idempotency = useRef<{ key: string; intent: string } | null>(null);
  const signature = JSON.stringify({ items, promo: appliedCode });

  // Quote after every change, 400 ms after the last one; a stale answer is dropped.
  useEffect(() => {
    if (!ready) return;
    if (items.length === 0) {
      router.replace('/cart');
      return;
    }
    const mine = ++sequence.current;
    const delay = immediate.current ? 0 : DEBOUNCE_MS;
    immediate.current = false;
    const timer = setTimeout(async () => {
      const result = await quoteCart({ items, promoCode: appliedCode ?? undefined });
      if (mine !== sequence.current) return;
      if (result.ok) {
        setQuote({ status: 'ok', sig: signature, data: result.data });
        setLastPriced(result.data);
        return;
      }
      const refusal = mapRefusal(result.code, result.details, lines);
      if (refusal.kind === 'promo') {
        // The field says why; the summary is priced again at once, without the code.
        setPromoRefusal(refusal);
        immediate.current = true;
        setAppliedCode(null);
        return;
      }
      setQuote(
        refusal.kind === 'failed'
          ? { status: 'failed', sig: signature }
          : { status: 'refused', sig: signature, refusal },
      );
    }, delay);
    return () => clearTimeout(timer);
  }, [ready, signature, retry, items, appliedCode, lines, router]);

  const fresh = quote.status !== 'idle' && quote.sig === signature;
  const refusal = fresh && quote.status === 'refused' ? quote.refusal : null;
  const atPlace = fresh && quote.status === 'refused' && quote.atPlace === true;
  const priced =
    quote.status === 'ok' ? quote.data : refusal || quote.status === 'failed' ? null : lastPriced;
  const canPlace = quote.status === 'ok' && fresh && !placing;
  const busy = !fresh && quote.status !== 'idle';

  const pricingFor = (index: number): LinePricing => {
    const line = priced?.lines[index];
    return line && priced?.lines.length === lines.length ? line : 'hidden';
  };

  const promoError = promoRefusal
    ? errorMessage(t, locale, 'PROMO_CODE_INVALID', {
        reason: promoRefusal.reason,
        minSubtotalVnd: promoRefusal.minSubtotalVnd,
      })
    : null;
  const appliedLabel =
    appliedCode && quote.status === 'ok' && fresh && quote.data.promoCode
      ? t('promo.applied', {
          code: quote.data.promoCode,
          amount: formatVnd(quote.data.promoDiscountVnd, locale),
        })
      : null;

  const applyPromo = () => {
    const code = promoInput.trim();
    if (code === '') return;
    setPromoRefusal(null);
    immediate.current = true;
    setAppliedCode(code);
  };
  const removePromo = () => {
    setPromoRefusal(null);
    setPromoInput('');
    immediate.current = true;
    setAppliedCode(null);
  };

  const onPlace = async () => {
    if (!canPlace) return;
    // One tap, one intent: the key is made at the tap and kept until the intent changes
    // (lines, code or note), so a double tap or a retry is the same order (conventions §11.1).
    const intent = JSON.stringify({ items, promo: appliedCode, note: note.trim() });
    if (idempotency.current?.intent !== intent) idempotency.current = { key: newId(), intent };
    setPlacing(true);
    setContended(false);
    const result = await placeOrder(
      { items, promoCode: appliedCode ?? undefined, note },
      idempotency.current.key,
    );
    if (result.ok) {
      markPlaced(result.data.id);
      router.push(`/orders/${result.data.id}`);
      return; // `placing` stays on while the page changes
    }
    setPlacing(false);
    if (result.code === 'STOCK_CONTENDED') {
      setContended(true); // the same key stays: a retry is the same intent
      return;
    }
    const mapped = mapRefusal(result.code, result.details, lines);
    if (mapped.kind === 'promo') {
      setPromoRefusal(mapped);
      immediate.current = true;
      setAppliedCode(null);
    } else if (mapped.kind === 'failed') {
      setQuote({ status: 'failed', sig: signature });
    } else {
      setQuote({
        status: 'refused',
        sig: signature,
        refusal: mapped,
        atPlace: result.code === 'OUT_OF_STOCK',
      });
    }
  };

  if (!ready) {
    return (
      <div className="mx-auto max-w-[30rem]" role="status" aria-label={t('common:loading')}>
        <div className="skeleton h-9 w-40" />
        <div className="skeleton rounded-box mt-4 h-24 w-full" />
        <div className="skeleton rounded-box mt-3 h-24 w-full" />
      </div>
    );
  }

  const stockLine =
    refusal?.kind === 'stock' ? lines.find((l) => refusal.available.has(l.key)) : undefined;
  const banner =
    refusal?.kind === 'products'
      ? t('refusal.products', { count: refusal.lineKeys.length })
      : refusal?.kind === 'option'
        ? t('refusal.option')
        : null;
  const blocked =
    refusal?.kind === 'products' || refusal?.kind === 'option' || refusal?.kind === 'stock';

  if (quote.status === 'failed' && fresh) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-12 text-center">
        <TriangleAlert aria-hidden size={40} />
        <h1 className="text-2xl font-bold">{t('failed.title')}</h1>
        <p>{t('failed.body')}</p>
        <button
          type="button"
          className="btn btn-primary w-full"
          onClick={() => setRetry((n) => n + 1)}
        >
          {t('failed.retry')}
        </button>
        <Link href="/cart" className="btn btn-ghost">
          {t('failed.back')}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[30rem] pb-44 lg:max-w-5xl lg:pb-0">
      <Link href="/cart" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium">
        <ChevronLeft aria-hidden size={18} />
        {t('back')}
      </Link>
      <h1 className="mt-2 text-3xl font-bold">{t('title')}</h1>
      <p className="mb-4">{t('subtitle')}</p>

      <div className="lg:grid lg:grid-cols-[1fr_24rem] lg:items-start lg:gap-10">
        <div className="flex flex-col gap-4">
          {banner && (
            <Alert type="info">
              <span className="flex items-start gap-2">
                <Info aria-hidden size={18} className="mt-0.5 shrink-0" />
                {banner}
              </span>
            </Alert>
          )}
          {atPlace && stockLine && (
            <Alert type="error">
              {t('refusal.stockAtPlace', { name: localized(stockLine.name, locale) })}
            </Alert>
          )}
          <section aria-labelledby="your-order">
            <h2 id="your-order" className="text-lg font-semibold">
              {t('yourOrder')}
            </h2>
            <ul>
              {lines.map((line, index) => (
                <Fragment key={line.key}>
                  {removed && removed.index === index && (
                    <UndoRow line={removed.line} onUndo={onUndo} onExpire={expire} />
                  )}
                  <CartLine
                    line={line}
                    onQuantity={(quantity) => setQuantity(line.key, quantity)}
                    onRemove={() => onRemove(line.key)}
                    unavailable={unavailableFor(refusal, line)}
                    pricing={pricingFor(index)}
                    stockLeft={stockLeftFor(refusal, line)}
                  />
                </Fragment>
              ))}
              {removed && removed.index >= lines.length && (
                <UndoRow line={removed.line} onUndo={onUndo} onExpire={expire} />
              )}
            </ul>
          </section>
        </div>

        <div className="mt-2 flex flex-col gap-4 lg:mt-0">
          <PromoField
            value={promoInput}
            onChange={(next) => {
              setPromoInput(next);
              setPromoRefusal(null);
            }}
            onApply={applyPromo}
            onRemove={removePromo}
            applying={appliedCode !== null && !appliedLabel}
            appliedLabel={appliedLabel}
            error={promoError}
          />
          <NoteField value={note} onChange={setNote} />
          <div aria-busy={busy} className={busy ? 'opacity-60' : undefined}>
            {refusal?.kind === 'total' ? (
              <div className="border-base-300 rounded-box border p-4">
                <p className="mb-3 font-medium">
                  {refusal.side === 'low'
                    ? t('refusal.tooLow', { min: formatVnd(refusal.limitVnd, locale) })
                    : t('refusal.tooHigh', { max: formatVnd(refusal.limitVnd, locale) })}
                </p>
                <Link href="/" className="btn btn-primary w-full">
                  {t('refusal.backToMenu')}
                </Link>
              </div>
            ) : (
              <QuoteSummary
                subtotalVnd={priced?.subtotalVnd ?? null}
                promoCode={priced?.promoCode ?? null}
                promoDiscountVnd={priced?.promoDiscountVnd ?? 0}
                totalVnd={priced?.totalVnd ?? null}
                pointsEarnable={priced?.pointsEarnable ?? null}
                showPoints
              />
            )}
          </div>

          <div className="border-base-300 bg-base-100 fixed inset-x-0 bottom-0 z-30 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:static lg:border-0 lg:bg-transparent lg:p-0">
            <div className="mx-auto max-w-[30rem] lg:max-w-none">
              <button
                type="button"
                onClick={onPlace}
                disabled={!canPlace}
                className="btn btn-primary w-full"
              >
                {placing
                  ? t('place.placing')
                  : priced && canPlace
                    ? t('place.label', { price: formatVnd(priced.totalVnd, locale) })
                    : t('place.labelUnpriced')}
              </button>
              <p className="mt-2 text-center text-sm" aria-live="polite">
                {contended
                  ? t('refusal.contended')
                  : blocked
                    ? t('place.blocked')
                    : t('place.hold', { minutes: ORDER_UNPAID_TTL_MS / 60_000 })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
