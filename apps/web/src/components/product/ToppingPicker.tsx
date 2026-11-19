'use client';

import { Check, Info } from 'lucide-react';
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
 * `aria-disabled` and dimmed — still focusable, so a keyboard user can find them and hear why — and
 * the limit line under the list is announced once (`aria-live`).
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
      <div className="mb-2 flex items-center justify-between" aria-hidden>
        <span className="text-lg leading-[26px] font-semibold">
          {t('product.toppings.heading')}
        </span>
        <span className="text-base-content/72 text-sm leading-5 font-medium">
          {chosen.size > 0
            ? t('product.toppings.chosen', { count: chosen.size, max })
            : t('product.toppings.upTo', { max })}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {choices.map((topping) => {
          const checked = chosen.has(topping.id);
          const blocked = atLimit && !checked;
          return (
            <li key={topping.id}>
              <label
                className={`rounded-field flex min-h-13 items-center gap-3 px-3.5 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary ${
                  checked
                    ? 'bg-secondary/60 border-primary/40 cursor-pointer border-2 font-semibold'
                    : blocked
                      ? 'border-base-content/15 bg-base-100 cursor-not-allowed border'
                      : 'border-base-content/30 bg-base-100 cursor-pointer border'
                }`}
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
                  className={`rounded-selector grid size-5.5 shrink-0 place-items-center ${
                    checked
                      ? 'bg-primary text-primary-content'
                      : `bg-base-100 border-[1.5px] ${blocked ? 'border-base-content/20' : 'border-base-content/50'}`
                  }`}
                >
                  {checked && <Check size={14} strokeWidth={3} />}
                </span>
                <span className={`flex-1 leading-6 ${blocked ? 'opacity-40' : ''}`}>
                  {localized(topping.name, locale)}
                </span>
                <span
                  className={`text-[15px] leading-[22px] font-medium tabular-nums ${blocked ? 'opacity-40' : 'opacity-80'}`}
                >
                  +{formatVnd(topping.priceVnd, locale)}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <p
        aria-live="polite"
        className={atLimit ? 'mt-2 flex items-center gap-2 pt-1 text-sm font-medium' : 'sr-only'}
      >
        {atLimit && <Info aria-hidden size={18} className="shrink-0" />}
        {atLimit ? t('product.toppings.limit', { max }) : ''}
      </p>
    </fieldset>
  );
}
