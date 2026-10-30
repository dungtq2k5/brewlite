'use client';

import { ChevronLeft, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { Fragment, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { totalVnd, type CartLine as Line } from '@/lib/cart/cart';
import { useCart } from '@/lib/cart/CartProvider';
import { CartLine } from './CartLine';
import { CartSummary } from './CartSummary';
import { UndoRow } from './UndoRow';

interface Removed {
  line: Line;
  index: number;
}

/** `/cart`: the lines from the device, no API call (ADR 0029). The server only says who is looking. */
export function CartView({ signedIn }: Readonly<{ signedIn: boolean }>) {
  const { t } = useTranslation(['cart', 'menu', 'common']);
  const { cart, ready, itemCount, setQuantity, remove, restore } = useCart();
  // One *Undo* at a time: removing a second line lets the first go for good.
  const [removed, setRemoved] = useState<Removed | null>(null);

  const expire = useCallback(() => setRemoved(null), []);

  const onRemove = (key: string) => {
    const result = remove(key);
    if (result.removed) setRemoved(result.removed);
  };
  const onUndo = () => {
    if (!removed) return;
    restore(removed.line, removed.index);
    setRemoved(null);
  };

  const back = (
    <Link href="/" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium">
      <ChevronLeft aria-hidden size={18} />
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

  return (
    <div className="mx-auto max-w-[30rem]">
      {back}
      {cart.lines.length === 0 ? (
        <>
          {removed && (
            <ul>
              <UndoRow line={removed.line} onUndo={onUndo} onExpire={expire} />
            </ul>
          )}
          <div className="flex flex-col items-center gap-4 px-4 py-12 text-center">
            <span className="bg-base-200 grid h-24 w-24 place-items-center rounded-full">
              <ShoppingBag aria-hidden size={40} />
            </span>
            <p className="text-lg font-medium">{t('empty.title')}</p>
            <Link href="/" className="btn btn-primary w-full">
              {t('empty.action')}
            </Link>
          </div>
        </>
      ) : (
        <>
          <h1 className="mt-2 flex items-baseline gap-3 text-3xl font-bold">
            {t('title')}
            <span className="text-base-content/70 text-base font-medium">
              {t('items', { count: itemCount })}
            </span>
          </h1>
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
