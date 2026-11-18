'use client';

import { Info, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MAX_LINES_PER_ORDER, MAX_QTY_PER_LINE } from '@brewlite/contracts';
import { formatVnd } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';
import type { AddState } from '@/lib/product-options';
import { QuantityStepper } from './QuantityStepper';

/**
 * The stepper and the add button: sticky at the bottom of a phone, inline under the toppings
 * from 1024 px. The 10-per-item hint sits in the content above the bar; the full-cart warning
 * sits in the bar. Sold out drops the stepper. The total sits on the button; a screen reader hears it from a polite, debounced
 * copy so a run of taps is not read out tap by tap.
 */
export function AddBar({
  state,
  quantity,
  onQuantity,
  totalVnd,
  name,
  pending,
  onAdd,
}: Readonly<{
  state: AddState;
  quantity: number;
  onQuantity: (next: number) => void;
  totalVnd: number;
  name: string;
  pending: boolean;
  onAdd: () => void;
}>) {
  const { t, i18n } = useTranslation('menu');
  const locale = i18n.language as Locale;
  const label = t('product.add.label', { price: formatVnd(totalVnd, locale) });

  const [announced, setAnnounced] = useState(label);
  useEffect(() => {
    const timer = setTimeout(() => setAnnounced(label), 600);
    return () => clearTimeout(timer);
  }, [label]);

  const blocked = state !== 'ready';
  const atMax = state === 'lineFull' || (state === 'ready' && quantity >= MAX_QTY_PER_LINE);

  return (
    <>
      {atMax && (
        <p className="flex items-center gap-2 text-sm font-medium">
          <Info aria-hidden size={18} className="shrink-0" />
          {t('product.quantity.max', { max: MAX_QTY_PER_LINE })}
        </p>
      )}
      {/* Sticky in the flow (not `fixed`): the page grows with its content and the bar ends it.
          The negative bottom margin eats `main`'s padding so the bar meets the screen's edge. */}
      <div className="border-base-300 bg-base-100 sticky bottom-0 z-30 -mx-4 mt-1 -mb-[max(1.5rem,env(safe-area-inset-bottom))] border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_8px_rgba(43,33,28,0.08)] lg:static lg:m-0 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
        {state === 'cartFull' && (
          <div className="alert alert-warning mb-2.5 items-start gap-3 px-4 py-3.5 text-[15px] leading-[22px] font-medium">
            <TriangleAlert aria-hidden size={22} className="shrink-0" />
            <span>{t('product.add.full', { max: MAX_LINES_PER_ORDER })}</span>
          </div>
        )}
        <div className="flex items-center gap-3">
          {state !== 'soldOut' && (
            <QuantityStepper value={quantity} onChange={onQuantity} name={name} />
          )}
          <button
            type="button"
            onClick={onAdd}
            disabled={blocked || pending}
            className="btn btn-primary disabled:bg-base-300 disabled:text-base-content/50 flex-1 px-2 text-base whitespace-nowrap max-[379px]:text-sm"
          >
            {state === 'soldOut'
              ? t('product.add.soldOut')
              : pending
                ? t('product.add.adding')
                : label}
          </button>
        </div>
        <p aria-live="polite" className="sr-only">
          {state === 'ready' || state === 'loading' ? announced : ''}
        </p>
      </div>
    </>
  );
}
