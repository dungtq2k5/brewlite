'use client';

import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatVnd, localized } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';

export interface ToppingChoice {
  id: string;
  name: { en: string; vi: string };
  priceVnd: number;
}

/**
 * A checkbox row per topping, the whole 52 px row tappable. At the limit the unchosen rows are
 * `aria-disabled` — still focusable, so a keyboard user can find them and hear why — and the
 * limit line is announced once (`aria-live`).
 */
export function ToppingPicker({
  choices,
  chosen,
  max,
  onToggle,
}: Readonly<{
  choices: ToppingChoice[];
  chosen: ReadonlySet<string>;
  max: number;
  onToggle: (id: string) => void;
}>) {
  const { t, i18n } = useTranslation('menu');
  const locale = i18n.language as Locale;
  if (choices.length === 0 || max === 0) return null;
  const atLimit = chosen.size >= max;

  return (
    <fieldset>
      <legend className="sr-only">{t('product.toppings.heading')}</legend>
      <div className="mb-2 flex items-baseline justify-between" aria-hidden>
        <span className="text-lg font-semibold">{t('product.toppings.heading')}</span>
        <span className="text-sm">
          {chosen.size > 0
            ? t('product.toppings.chosen', { count: chosen.size, max })
            : t('product.toppings.upTo', { max })}
        </span>
      </div>
      <p aria-live="polite" className={atLimit ? 'mb-2 text-sm' : 'sr-only'}>
        {atLimit ? t('product.toppings.limit', { max }) : ''}
      </p>
      <ul className="flex flex-col gap-2">
        {choices.map((topping) => {
          const checked = chosen.has(topping.id);
          const blocked = atLimit && !checked;
          return (
            <li key={topping.id}>
              <label
                className={`rounded-box flex min-h-[3.25rem] items-center gap-3 border px-3 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
                  checked
                    ? 'bg-secondary/60 border-primary/40 font-semibold'
                    : 'border-base-300 bg-base-100'
                } ${blocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  aria-disabled={blocked || undefined}
                  onChange={() => !blocked && onToggle(topping.id)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className={`grid size-6 shrink-0 place-items-center rounded-md border-2 ${
                    checked
                      ? 'border-primary bg-primary text-primary-content'
                      : 'border-base-content/50'
                  }`}
                >
                  {checked && <Check size={16} strokeWidth={3} />}
                </span>
                <span className="flex-1">{localized(topping.name, locale)}</span>
                <span className="text-sm tabular-nums">+{formatVnd(topping.priceVnd, locale)}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
