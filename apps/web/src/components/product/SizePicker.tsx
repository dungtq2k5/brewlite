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

/** The offered sizes, each showing what the drink costs in it. One size → no picker: the heading and one muted line. */
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
      <div>
        <p className="mb-2.5 text-lg leading-[26px] font-semibold">{t('product.size.heading')}</p>
        <p className="text-base-content/75 text-[15px] leading-[22px]">
          {t('product.size.single', { price: formatVnd(choices[0]!.priceVnd, locale) })}
        </p>
      </div>
    );
  }

  return (
    <fieldset>
      <legend className="mb-2.5 text-lg leading-[26px] font-semibold">
        {t('product.size.heading')}
      </legend>
      <div className="flex gap-2">
        {choices.map((choice) => {
          const selected = choice.size === value;
          return (
            <label
              key={choice.size}
              className={`rounded-field flex min-h-18 min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 px-1 py-2 text-center text-[15px] leading-[22px] has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
                selected
                  ? 'bg-secondary border-primary text-secondary-content border-2 font-bold'
                  : 'border-base-content/30 bg-base-100 border font-semibold'
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
              <span className="text-sm leading-5 font-normal tabular-nums opacity-80">
                {formatVnd(choice.priceVnd, locale)}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
