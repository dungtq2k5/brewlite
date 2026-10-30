'use client';

import { TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MAX_LINES_PER_ORDER, MAX_QTY_PER_LINE } from '@brewlite/contracts';
import { formatVnd } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';
import type { AddState } from '@/lib/product-options';
import { QuantityStepper } from './QuantityStepper';

/**
 * The stepper and the add button: sticky at the bottom of a phone, inline under the toppings
 * from 1024 px. The total sits on the button; a screen reader hears it from a polite, debounced
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
  const hint =
    state === 'cartFull'
      ? t('product.add.full', { max: MAX_LINES_PER_ORDER })
      : state === 'lineFull' || (state === 'ready' && quantity >= MAX_QTY_PER_LINE)
        ? t('product.quantity.max', { max: MAX_QTY_PER_LINE })
        : null;

  return (
    <div className="border-base-300 bg-base-100 fixed inset-x-0 bottom-0 z-30 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:static lg:mt-6 lg:border-0 lg:bg-transparent lg:p-0">
      {hint && (
        <p
          className={`mb-2 flex items-start gap-2 text-sm ${state === 'cartFull' ? 'text-error font-medium' : ''}`}
        >
          {state === 'cartFull' && (
            <TriangleAlert aria-hidden size={18} className="mt-0.5 shrink-0" />
          )}
          {hint}
        </p>
      )}
      <div className="mx-auto flex max-w-[70rem] items-center gap-3 lg:max-w-none">
        <QuantityStepper
          value={quantity}
          onChange={onQuantity}
          name={name}
          disabled={state === 'soldOut'}
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={blocked || pending}
          className="btn btn-primary flex-1 px-2 text-sm whitespace-nowrap sm:text-base"
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
  );
}
