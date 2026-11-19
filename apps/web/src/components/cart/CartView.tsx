'use client';

import { ChevronLeft, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { totalVnd } from '@/lib/cart/cart';
import { useCart } from '@/lib/cart/CartProvider';
import { CartLine } from './CartLine';
import { CartSummary } from './CartSummary';
import { UndoRow } from './UndoRow';
import { useUndoableRemove } from './useUndoableRemove';

/** `/cart`: the lines from the device, no API call (ADR 0029). The server only says who is looking. */
export function CartView({ signedIn }: Readonly<{ signedIn: boolean }>) {
  const { t } = useTranslation(['cart', 'menu', 'common']);
  const { cart, ready, itemCount, setQuantity } = useCart();
  const { removed, onRemove, onUndo, expire } = useUndoableRemove();

  const back = (
    <Link
      href="/"
      className="inline-flex min-h-11 items-center gap-1 text-[15px] leading-[22px] font-medium"
    >
      <ChevronLeft aria-hidden size={20} />
      {t('menu:product.back')}
    </Link>
  );

  if (!ready) {
    return (
      <div className="mx-auto max-w-[30rem]" role="status" aria-label={t('common:loading')}>
        <div className="skeleton h-9 w-40" />
        <div className="skeleton rounded-box mt-4 h-24 w-full" />
        <div className="skeleton rounded-box mt-3 h-24 w-full" />
      </div>
    );
  }

  const rows = cart.lines.map((line, i) => (
    <Fragment key={line.key}>
      {removed && removed.index === i && (
        <UndoRow line={removed.line} onUndo={onUndo} onExpire={expire} />
      )}
      <CartLine
        line={line}
        onQuantity={(quantity) => setQuantity(line.key, quantity)}
        onRemove={() => onRemove(line.key)}
      />
    </Fragment>
  ));

  const empty = cart.lines.length === 0;

  return (
    // Bottom room for the fixed summary bar, so the last line scrolls clear of it.
    <div className={`mx-auto max-w-[30rem] ${empty ? '' : 'pb-36'}`}>
      {back}
      <h1 className="mt-2 flex items-baseline gap-2 text-[28px] leading-9 font-bold">
        {t('title')}
        {!empty && (
          <span className="text-base-content/72 text-base leading-6 font-normal">
            {t('items', { count: itemCount })}
          </span>
        )}
      </h1>
      {empty ? (
        <>
          {removed && (
            <ul className="mt-2">
              <UndoRow line={removed.line} onUndo={onUndo} onExpire={expire} />
            </ul>
          )}
          <div className="mt-2 flex flex-col items-center gap-4 py-8 text-center">
            <span className="bg-secondary grid size-22 place-items-center rounded-full">
              <ShoppingBag aria-hidden size={40} />
            </span>
            <p className="text-[17px] leading-[26px] font-semibold">{t('empty.title')}</p>
            <Link href="/" className="btn btn-primary">
              {t('empty.action')}
            </Link>
          </div>
        </>
      ) : (
        <>
          <ul className="mt-2">
            {rows}
            {removed && removed.index >= cart.lines.length && (
              <UndoRow line={removed.line} onUndo={onUndo} onExpire={expire} />
            )}
          </ul>
          <CartSummary itemCount={itemCount} totalVnd={totalVnd(cart)} signedIn={signedIn} />
        </>
      )}
    </div>
  );
}
