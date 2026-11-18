'use client';

import { Minus, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MAX_QTY_PER_LINE } from '@brewlite/contracts';

/** 44 px buttons; the number is the middle. Stops at 1 and at `max` (10): the end button loses its fill and drops to 30 % ink. */
export function QuantityStepper({
  value,
  onChange,
  name,
  max = MAX_QTY_PER_LINE,
  disabled = false,
}: Readonly<{
  value: number;
  onChange: (next: number) => void;
  /** The product's name — the buttons say what they change. */
  name: string;
  max?: number;
  disabled?: boolean;
}>) {
  const { t } = useTranslation('menu');
  const button =
    'bg-base-100 grid size-11 place-items-center rounded-full disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-30';
  return (
    <div
      role="group"
      aria-label={t('product.quantity.label')}
      className="bg-base-200 border-base-300 inline-flex items-center rounded-full border px-0.5"
    >
      <button
        type="button"
        className={button}
        aria-label={t('product.quantity.decrease', { name })}
        disabled={disabled || value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <Minus aria-hidden size={20} />
      </button>
      <output className="w-9 text-center text-[17px] leading-6 font-semibold tabular-nums">
        {value}
      </output>
      <button
        type="button"
        className={button}
        aria-label={t('product.quantity.increase', { name })}
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus aria-hidden size={20} />
      </button>
    </div>
  );
}
