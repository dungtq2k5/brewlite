'use client';

import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { formatVnd } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';

export interface SizeChoice {
  size: string;
  /** The resulting price (base + size delta) — people compare totals, not deltas. */
  priceVnd: number;
}

/** The offered sizes, each showing what the drink costs in it. One size → no picker, one line. */
export function SizePicker({
  choices,
  value,
  onChange,
}: Readonly<{ choices: SizeChoice[]; value: string; onChange: (size: string) => void }>) {
  const { t, i18n } = useTranslation('menu');
  const locale = i18n.language as Locale;
  const group = useId();

  if (choices.length === 1) {
    return (
      <p className="font-medium">
        {t('product.size.single', { price: formatVnd(choices[0]!.priceVnd, locale) })}
      </p>
    );
  }

  return (
    <fieldset>
      <legend className="mb-2 text-lg font-semibold">{t('product.size.heading')}</legend>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] gap-3">
        {choices.map((choice) => {
          const selected = choice.size === value;
          return (
            <label
              key={choice.size}
              className={`rounded-box flex min-h-14 cursor-pointer flex-col items-center justify-center border-2 px-3 py-2 text-center has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
                selected ? 'bg-secondary border-primary font-bold' : 'border-base-300 bg-base-100'
              }`}
            >
              <input
                type="radio"
                name={group}
                value={choice.size}
                checked={selected}
                onChange={() => onChange(choice.size)}
                className="sr-only"
              />
              <span>
                {choice.size} · {t(`product.size.name.${choice.size}`)}
              </span>
              <span className="text-sm tabular-nums">{formatVnd(choice.priceVnd, locale)}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
